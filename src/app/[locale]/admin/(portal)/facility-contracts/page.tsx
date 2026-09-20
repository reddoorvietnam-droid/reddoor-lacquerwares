import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDate } from "@/app/[locale]/admin/(portal)/finance/shared";
import {
  contractValue,
  facilityContractStatuses,
  facilityPaymentStatuses,
  paymentNextActor,
  type FacilityContractStatus,
  type FacilityPaymentStatus,
} from "@/domains/facility-contracts/contracts";
import { listActiveFacilities } from "@/domains/facility-contracts/persistence/mongo-store";
import { facilityContractService } from "@/domains/facility-contracts/runtime";
import { orderCommandService } from "@/domains/orders/runtime";
import { isTerminalStage } from "@/domains/orders/workflow";
import {
  ContentAccessDeniedError,
  requireListAccess,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatMoney } from "@/lib/money";

import { createFacilityContractAction } from "./actions";
import { ContractForm, type OrderOption } from "./contract-form";
import {
  cardClass,
  contractStatusBadge,
  contractStatusLabels,
  errorMessages,
  fieldClass,
  formatVnd,
  ghostButtonClass,
  headingClass,
  labelClass,
  messageFor,
  nextActorLabels,
  paymentStatusBadge,
  paymentStatusLabels,
  tableWrapClass,
  tdClass,
  thClass,
  theadRowClass,
} from "./shared";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Cơ sở sản xuất",
    title: "Hợp đồng cơ sở",
    description:
      "Hợp đồng mua hàng với các cơ sở sản xuất, các đề nghị thanh toán cho cơ sở và số tiền còn phải trả từng cơ sở.",
    tabs: {
      contracts: "Hợp đồng",
      payments: "Đề nghị thanh toán",
      balances: "Công nợ cơ sở",
    },
    createTitle: "Tạo hợp đồng",
    status: "Trạng thái",
    allStatuses: "Tất cả",
    search: "Tìm kiếm",
    searchPlaceholder: "Mã hợp đồng, cơ sở, mã đơn, mã hàng…",
    filter: "Lọc",
    codeColumn: "Mã hợp đồng",
    siteColumn: "Cơ sở",
    orderColumn: "Đơn hàng",
    linesColumn: "Số dòng",
    valueColumn: "Giá trị",
    deliveryColumn: "Ngày giao",
    statusColumn: "Trạng thái",
    noContracts: "Chưa có hợp đồng nào.",
    paymentCodeColumn: "Mã đề nghị",
    contractColumn: "Hợp đồng",
    amountColumn: "Số tiền",
    nextColumn: "Việc tiếp theo",
    noPayments: "Chưa có đề nghị thanh toán nào.",
    balanceHint:
      "Chỉ tính các hợp đồng đang thực hiện. Còn phải trả = giá trị đã tính được − đã chi.",
    knownValueColumn: "Giá trị hợp đồng",
    unknownColumn: "HĐ chưa tính được giá trị",
    paidColumn: "Đã chi",
    approvedUnpaidColumn: "Đã duyệt, chưa chi",
    remainingColumn: "Còn phải trả",
    activeColumn: "HĐ đang thực hiện",
    noBalances: "Chưa có hợp đồng nào đang thực hiện.",
    errorLead: "Thao tác không thành công:",
  },
  en: {
    eyebrow: "Production sites",
    title: "Site contracts",
    description:
      "Purchase contracts with the production sites, the payment requests to them and what each site is still owed.",
    tabs: {
      contracts: "Contracts",
      payments: "Payment requests",
      balances: "Site balances",
    },
    createTitle: "Create contract",
    status: "Status",
    allStatuses: "All",
    search: "Search",
    searchPlaceholder: "Contract code, site, order code, item code…",
    filter: "Filter",
    codeColumn: "Contract code",
    siteColumn: "Site",
    orderColumn: "Order",
    linesColumn: "Lines",
    valueColumn: "Value",
    deliveryColumn: "Delivery",
    statusColumn: "Status",
    noContracts: "No contracts yet.",
    paymentCodeColumn: "Request code",
    contractColumn: "Contract",
    amountColumn: "Amount",
    nextColumn: "Next step",
    noPayments: "No payment requests yet.",
    balanceHint:
      "Only active contracts count. Still owed = known value − paid.",
    knownValueColumn: "Contract value",
    unknownColumn: "Contracts without a value",
    paidColumn: "Paid",
    approvedUnpaidColumn: "Approved, unpaid",
    remainingColumn: "Still owed",
    activeColumn: "Active contracts",
    noBalances: "No active contracts yet.",
    errorLead: "The action failed:",
  },
} as const;

const tabs = ["contracts", "payments", "balances"] as const;
type Tab = (typeof tabs)[number];

export default async function FacilityContractsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tab?: string;
    status?: string;
    q?: string;
    error?: string;
  }>;
}) {
  const [{ locale: requestedLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  let context;
  try {
    context = await requirePermission("facilityContracts.read");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const tab: Tab = (tabs as readonly string[]).includes(query.tab ?? "")
    ? (query.tab as Tab)
    : "contracts";
  const base = `/${locale}/admin/facility-contracts`;

  return (
    <div>
      <p className="eyebrow">{text.eyebrow}</p>
      <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {text.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {text.description}
      </p>

      {query.error ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-8 max-w-3xl rounded-2xl border px-5 py-4 text-sm">
          {text.errorLead} {messageFor(errorMessages, query.error, locale)}
        </p>
      ) : null}

      <nav className="mt-8 flex flex-wrap gap-2" aria-label={text.title}>
        {tabs.map((key) => (
          <Link
            key={key}
            href={`${base}?tab=${key}` as Route}
            aria-current={key === tab ? "page" : undefined}
            className={
              key === tab
                ? "bg-burgundy text-ivory inline-flex min-h-10 items-center rounded-full px-5 text-sm font-semibold"
                : "border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-10 items-center rounded-full border px-5 text-sm font-semibold"
            }
          >
            {text.tabs[key]}
          </Link>
        ))}
      </nav>

      {tab === "contracts" ? (
        <ContractsTab
          locale={locale}
          base={base}
          status={query.status}
          search={query.q ?? ""}
          context={context}
        />
      ) : tab === "payments" ? (
        <PaymentsTab
          locale={locale}
          base={base}
          status={query.status}
          context={context}
        />
      ) : (
        <BalancesTab locale={locale} context={context} />
      )}
    </div>
  );
}

type ReaderContext = Awaited<ReturnType<typeof requirePermission>>;

async function openOrders(): Promise<OrderOption[]> {
  try {
    const { scope } = await requireListAccess("orders.read");
    const filter =
      scope.kind === "all"
        ? ({ kind: "all" } as const)
        : scope.kind === "businessUnits"
          ? ({
              kind: "businessUnits",
              businessUnitIds: scope.businessUnitIds,
            } as const)
          : ({ kind: "own", userId: scope.userId } as const);
    const orders = await orderCommandService.list(filter, false);
    return orders
      .filter((order) => !isTerminalStage(order.stage))
      .map((order) => ({
        id: order.id,
        orderCode: order.orderCode,
        customerName: order.customerName,
      }));
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) return [];
    throw cause;
  }
}

async function ContractsTab({
  locale,
  base,
  status,
  search,
  context,
}: {
  locale: "vi" | "en";
  base: string;
  status: string | undefined;
  search: string;
  context: ReaderContext;
}) {
  const text = copy[locale];
  const statusFilter = (facilityContractStatuses as readonly string[]).includes(
    status ?? "",
  )
    ? (status as FacilityContractStatus)
    : undefined;

  const coverages = await resolvePermissionCoverages([
    "facilityContracts.manage",
  ] as const);
  const canManage = coverages["facilityContracts.manage"].global;

  const [contracts, facilities, orders] = await Promise.all([
    facilityContractService.listContracts(context, { status: statusFilter }),
    canManage ? listActiveFacilities() : Promise.resolve([]),
    canManage ? openOrders() : Promise.resolve([]),
  ]);

  const needle = search.trim().toLocaleLowerCase("vi");
  const visible = needle
    ? contracts.filter((contract) =>
        [
          contract.code,
          contract.facilityName,
          contract.facilityCode,
          contract.orderCode ?? "",
          ...contract.lines.flatMap((line) => [
            line.productCode,
            line.description,
          ]),
        ].some((value) => value.toLocaleLowerCase("vi").includes(needle)),
      )
    : contracts;

  return (
    <>
      {canManage ? (
        <section className={`${cardClass} mt-8`}>
          <h2 className={headingClass}>{text.createTitle}</h2>
          <div className="mt-5">
            <ContractForm
              locale={locale}
              action={createFacilityContractAction}
              facilities={facilities}
              orders={orders}
            />
          </div>
        </section>
      ) : null}

      <form
        method="get"
        action={base}
        className="mt-8 flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="tab" value="contracts" />
        <div>
          <label htmlFor="contract-status" className={labelClass}>
            {text.status}
          </label>
          <select
            id="contract-status"
            name="status"
            defaultValue={statusFilter ?? ""}
            className={fieldClass}
          >
            <option value="">{text.allStatuses}</option>
            {facilityContractStatuses.map((key) => (
              <option key={key} value={key}>
                {contractStatusLabels[key][locale]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="contract-search" className={labelClass}>
            {text.search}
          </label>
          <input
            id="contract-search"
            name="q"
            defaultValue={search}
            placeholder={text.searchPlaceholder}
            className={fieldClass}
          />
        </div>
        <button type="submit" className={ghostButtonClass}>
          {text.filter}
        </button>
      </form>

      <section className="mt-6">
        {visible.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.noContracts}
          </p>
        ) : (
          <div className={tableWrapClass}>
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <caption className="sr-only">{text.tabs.contracts}</caption>
              <thead>
                <tr className={theadRowClass}>
                  <th scope="col" className={thClass}>
                    {text.codeColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.siteColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.orderColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.linesColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.valueColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.deliveryColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.statusColumn}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((contract) => {
                  const value = contractValue(contract.lines);
                  return (
                    <tr
                      key={contract.id}
                      className="border-burgundy/8 border-b"
                    >
                      <th scope="row" className={tdClass}>
                        <Link
                          href={`${base}/${contract.id}` as Route}
                          className="text-burgundy font-mono text-sm font-semibold hover:underline"
                        >
                          {contract.code}
                        </Link>
                      </th>
                      <td className={`${tdClass} text-charcoal/75`}>
                        {contract.facilityName}
                      </td>
                      <td className={`${tdClass} font-mono text-xs`}>
                        {contract.orderCode ?? "—"}
                      </td>
                      <td className={`${tdClass} text-charcoal/75`}>
                        {contract.lines.length}
                      </td>
                      <td className={`${tdClass} font-mono text-xs`}>
                        {value ? formatMoney(value, locale) : "—"}
                      </td>
                      <td className={`${tdClass} text-xs`}>
                        {formatDate(contract.deliveryDate, locale)}
                      </td>
                      <td className={tdClass}>
                        <span className={contractStatusBadge[contract.status]}>
                          {contractStatusLabels[contract.status][locale]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

async function PaymentsTab({
  locale,
  base,
  status,
  context,
}: {
  locale: "vi" | "en";
  base: string;
  status: string | undefined;
  context: ReaderContext;
}) {
  const text = copy[locale];
  const statusFilter = (facilityPaymentStatuses as readonly string[]).includes(
    status ?? "",
  )
    ? (status as FacilityPaymentStatus)
    : undefined;
  const payments = await facilityContractService.listPayments(context, {
    status: statusFilter,
  });

  return (
    <>
      <form
        method="get"
        action={base}
        className="mt-8 flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="tab" value="payments" />
        <div>
          <label htmlFor="payment-status" className={labelClass}>
            {text.status}
          </label>
          <select
            id="payment-status"
            name="status"
            defaultValue={statusFilter ?? ""}
            className={fieldClass}
          >
            <option value="">{text.allStatuses}</option>
            {facilityPaymentStatuses.map((key) => (
              <option key={key} value={key}>
                {paymentStatusLabels[key][locale]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={ghostButtonClass}>
          {text.filter}
        </button>
      </form>

      <section className="mt-6">
        {payments.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.noPayments}
          </p>
        ) : (
          <div className={tableWrapClass}>
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <caption className="sr-only">{text.tabs.payments}</caption>
              <thead>
                <tr className={theadRowClass}>
                  <th scope="col" className={thClass}>
                    {text.paymentCodeColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.contractColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.siteColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.amountColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.statusColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.nextColumn}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const next = paymentNextActor(payment.status);
                  return (
                    <tr key={payment.id} className="border-burgundy/8 border-b">
                      <th
                        scope="row"
                        className={`${tdClass} font-mono text-xs font-semibold`}
                      >
                        {payment.code}
                      </th>
                      <td className={tdClass}>
                        <Link
                          href={
                            `${base}/${payment.contractId}#payments` as Route
                          }
                          className="text-burgundy font-mono text-sm font-semibold hover:underline"
                        >
                          {payment.contractCode}
                        </Link>
                      </td>
                      <td className={`${tdClass} text-charcoal/75`}>
                        {payment.facilityName}
                      </td>
                      <td className={`${tdClass} font-mono text-xs`}>
                        {formatVnd(payment.amount, locale)}
                      </td>
                      <td className={tdClass}>
                        <span className={paymentStatusBadge[payment.status]}>
                          {paymentStatusLabels[payment.status][locale]}
                        </span>
                      </td>
                      <td className={`${tdClass} text-charcoal/70 text-xs`}>
                        {next ? nextActorLabels[next][locale] : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

async function BalancesTab({
  locale,
  context,
}: {
  locale: "vi" | "en";
  context: ReaderContext;
}) {
  const text = copy[locale];
  const balances = await facilityContractService.balances(context);

  return (
    <section className="mt-8">
      <p className="text-charcoal/60 mb-4 text-sm">{text.balanceHint}</p>
      {balances.length === 0 ? (
        <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
          {text.noBalances}
        </p>
      ) : (
        <div className={tableWrapClass}>
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <caption className="sr-only">{text.tabs.balances}</caption>
            <thead>
              <tr className={theadRowClass}>
                <th scope="col" className={thClass}>
                  {text.siteColumn}
                </th>
                <th scope="col" className={thClass}>
                  {text.activeColumn}
                </th>
                <th scope="col" className={thClass}>
                  {text.knownValueColumn}
                </th>
                <th scope="col" className={thClass}>
                  {text.unknownColumn}
                </th>
                <th scope="col" className={thClass}>
                  {text.paidColumn}
                </th>
                <th scope="col" className={thClass}>
                  {text.approvedUnpaidColumn}
                </th>
                <th scope="col" className={thClass}>
                  {text.remainingColumn}
                </th>
              </tr>
            </thead>
            <tbody>
              {balances.map((row) => (
                <tr key={row.facilityId} className="border-burgundy/8 border-b">
                  <th
                    scope="row"
                    className={`${tdClass} text-burgundy font-semibold`}
                  >
                    {row.facilityName}
                  </th>
                  <td className={tdClass}>{row.activeContracts}</td>
                  <td className={`${tdClass} font-mono text-xs`}>
                    {formatMoney(row.knownValue, locale)}
                  </td>
                  <td className={tdClass}>{row.unknownValueContracts}</td>
                  <td className={`${tdClass} font-mono text-xs`}>
                    {formatMoney(row.paid, locale)}
                  </td>
                  <td className={`${tdClass} font-mono text-xs`}>
                    {formatMoney(row.approvedUnpaid, locale)}
                  </td>
                  <td
                    className={`${tdClass} text-burgundy font-mono text-xs font-semibold`}
                  >
                    {formatMoney(row.remaining, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
