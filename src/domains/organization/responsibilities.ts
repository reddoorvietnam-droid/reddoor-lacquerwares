import type { Permission } from "@/domains/identity/permissions";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";

/**
 * The company's operating structure, expressed as positions rather than people.
 *
 * The organisation chart names individuals; this registry deliberately does not.
 * A position is filled by granting its role to a user, so a handover is a grant
 * change and never a code change.
 *
 * Sources: the confirmed organisation chart, the fifteen-step order process
 * chart, and the working-group thread in which each position stated the data it
 * owns and the paper forms it needs rebuilt in the system.
 */

export type OrganizationPosition = {
  readonly key: string;
  readonly labels: { readonly vi: string; readonly en: string };
  /** Roles granted to whoever holds this position. */
  readonly roleKeys: readonly SystemRoleKey[];
  /** Responsibilities as stated on the organisation chart. */
  readonly responsibilities: {
    readonly vi: readonly string[];
    readonly en: readonly string[];
  };
  /** The data this position is accountable for keeping current. */
  readonly ownedData: {
    readonly vi: readonly string[];
    readonly en: readonly string[];
  };
};

export const organizationPositions = [
  {
    key: "director",
    labels: { vi: "Giám đốc", en: "Director" },
    roleKeys: ["DIRECTOR"],
    responsibilities: {
      vi: [
        "Quản trị hệ thống và người dùng",
        "Phê duyệt toàn bộ nghiệp vụ trọng yếu trên hệ thống",
        "Phê duyệt đơn hàng, giá bán và điều khoản thanh toán",
        "Xác nhận ưu tiên sản xuất",
        "Xem báo cáo hợp nhất và lợi nhuận",
        "Quản lý và xuất bản nội dung website",
      ],
      en: [
        "Platform and user administration",
        "Approves every significant operation in the system",
        "Approves orders, selling price, and payment terms",
        "Confirms production priority",
        "Reads consolidated and profit reporting",
        "Manages and publishes website content",
      ],
    },
    ownedData: {
      vi: [
        "Đơn hàng khách đặt, đã xuất, đã đặt cọc và đã thanh toán",
        "Quyết định phê duyệt và lý do từ chối",
        "Dữ liệu nội dung website",
      ],
      en: [
        "Orders placed, dispatched, deposited, and paid",
        "Approval decisions and rejection reasons",
        "Website content data",
      ],
    },
  },
  {
    key: "company-accountant",
    labels: { vi: "Kế toán công ty", en: "Company Accountant" },
    // Also coordinates customers, quotes, and orders since the former Order
    // Manager role merged into COMPANY_ACCOUNTANT.
    roleKeys: ["COMPANY_ACCOUNTANT"],
    responsibilities: {
      vi: [
        "Kế toán và tài chính",
        "Tiếp nhận đơn hàng, khách hàng và báo giá",
        "Điều phối giao hàng",
        "Hồ sơ thanh toán",
        "Hồ sơ nhập khẩu và xuất khẩu",
        "Xác nhận lương",
        "Báo cáo lãi lỗ hàng tháng",
      ],
      en: [
        "Accounting and finance",
        "Order intake, customers, and quotes",
        "Delivery coordination",
        "Payment records",
        "Import and export files",
        "Payroll confirmation",
        "Monthly profit and loss reporting",
      ],
    },
    ownedData: {
      vi: [
        "Hồ sơ khách hàng, yêu cầu báo giá và báo giá",
        "Kế hoạch đóng hàng và chứng từ",
        "Thanh toán của khách hàng và công nợ phải thu",
        "Thông tin nhập khẩu hàng hóa: giá trị và giấy phép",
        "Tờ khai và chứng từ xuất nhập khẩu",
      ],
      en: [
        "Customer records, quote requests, and quotes",
        "Loading plan and trade documents",
        "Customer payments and receivables",
        "Import data: declared value and permits",
        "Customs declarations and import/export documents",
      ],
    },
  },
  {
    key: "factory-manager",
    labels: { vi: "Quản lý nhà máy", en: "Factory Manager" },
    // Also records progress on behalf of the sub-workshops (they no longer
    // sign in) and runs product development and sample orders, since the
    // former Production Unit and Product Designer roles merged in.
    roleKeys: ["FACTORY_MANAGER"],
    responsibilities: {
      vi: [
        "Tổ chức sản xuất",
        "Chi phí nhà máy",
        "Quản lý xưởng phụ",
        "Ghi nhận tiến độ, vật tư và chất lượng thay xưởng phụ",
        "Lập kế hoạch sản xuất",
        "Theo dõi chất lượng",
        "Phát triển sản phẩm và đơn hàng mẫu",
      ],
      en: [
        "Production organisation",
        "Factory cost",
        "Sub-workshop management",
        "Records progress, material use, and quality for the sub-workshops",
        "Production planning",
        "Quality tracking",
        "Product development and sample orders",
      ],
    },
    ownedData: {
      vi: [
        "Thông tin thu chi xưởng",
        "Lịch sản xuất, in ấn, ép khuôn và đóng hàng",
        "Tiến độ và bằng chứng chất lượng của các xưởng",
        "Ảnh sản phẩm và ảnh bộ sưu tập",
      ],
      en: [
        "Workshop income and expenditure",
        "Production, printing, moulding, and loading schedules",
        "Workshop progress and quality evidence",
        "Product and collection imagery",
      ],
    },
  },
  {
    key: "factory-accountant",
    labels: { vi: "Kế toán nhà máy", en: "Factory Accountant" },
    // Supplier and purchasing coordination merged into FACTORY_ACCOUNTANT
    // itself, so one role key covers this position.
    roleKeys: ["FACTORY_ACCOUNTANT"],
    responsibilities: {
      vi: [
        "Kiểm soát chi phí nhà máy",
        "Báo cáo chi phí nhà máy và xưởng phụ",
        "Báo cáo chi phí lao động",
        "Báo cáo cho kế toán công ty",
      ],
      en: [
        "Factory cost control",
        "Factory and sub-workshop cost reporting",
        "Labor cost reporting",
        "Reporting to the Company Accountant",
      ],
    },
    ownedData: {
      vi: [
        "Thông tin nhà cung cấp và số lượng nhà cung cấp",
        "Hợp đồng đang thực hiện: ngày nhận, ngày giao và giá trị đơn hàng",
        "Tạm ứng, bổ sung và thay đổi đơn giá",
        "Công nợ các cơ sở",
      ],
      en: [
        "Supplier directory and supplier count",
        "Active contracts: received date, delivery date, and order value",
        "Advances, supplements, and unit-price changes",
        "Payables by production site",
      ],
    },
  },
  {
    key: "warehouse-manager",
    labels: {
      vi: "Thủ kho / Quản lý kho",
      en: "Storekeeper / Warehouse Manager",
    },
    roleKeys: ["WAREHOUSE_MANAGER"],
    responsibilities: {
      vi: [
        "Quản lý tồn kho",
        "Hồ sơ lao động",
        "Bán hàng nội bộ",
        "Nhận và xuất vật tư",
        "Đối chiếu tồn kho",
      ],
      en: [
        "Inventory management",
        "Labor records",
        "Internal sales",
        "Material receipt and issue",
        "Stock reconciliation",
      ],
    },
    ownedData: {
      vi: ["Thông tin kho: tồn, xuất và nhập", "Nhân công tại xưởng"],
      en: [
        "Inventory: on hand, issued, and received",
        "Workshop labor headcount",
      ],
    },
  },
] as const satisfies readonly OrganizationPosition[];

/**
 * Paper forms the company currently runs on, which the working group asked to be
 * rebuilt in the system. The request was explicitly for the forms themselves,
 * not for their historical data to be migrated.
 *
 * `status` is honest about what exists today: `available` means the screen is
 * built and persists records; `planned` means only the definition below exists.
 */
export type OperationalFormStatus = "available" | "planned";

export type OperationalForm = {
  readonly key: string;
  readonly labels: { readonly vi: string; readonly en: string };
  readonly ownerPositionKey: (typeof organizationPositions)[number]["key"];
  readonly permission: Permission;
  readonly status: OperationalFormStatus;
};

// Annotated rather than `as const` so a form flipping to `available` does not
// change the array's type and narrow comparisons at the call sites.
export const operationalForms: readonly OperationalForm[] = [
  // Factory Manager
  {
    key: "supplier-contract",
    labels: { vi: "Form hợp đồng", en: "Contract form" },
    ownerPositionKey: "factory-manager",
    permission: "procurement.create",
    status: "planned",
  },
  {
    key: "goods-inspection",
    labels: { vi: "Form kiểm hàng", en: "Goods inspection form" },
    ownerPositionKey: "factory-manager",
    permission: "production.recordQcEvidence",
    status: "planned",
  },
  // Storekeeper
  {
    key: "lacquer-issue",
    labels: { vi: "Form giao sơn", en: "Lacquer issue form" },
    ownerPositionKey: "warehouse-manager",
    permission: "inventory.issue",
    status: "planned",
  },
  {
    key: "raw-body-issue",
    labels: { vi: "Form giao mộc", en: "Raw body issue form" },
    ownerPositionKey: "warehouse-manager",
    permission: "inventory.issue",
    status: "planned",
  },
  {
    key: "raw-body-inspection",
    labels: { vi: "Form kiểm mộc", en: "Raw body inspection form" },
    ownerPositionKey: "warehouse-manager",
    permission: "production.recordQcEvidence",
    status: "planned",
  },
  {
    key: "lacquer-sale",
    labels: { vi: "Form bán sơn", en: "Lacquer sale form" },
    ownerPositionKey: "warehouse-manager",
    permission: "inventory.issue",
    status: "planned",
  },
  {
    key: "payroll-sheet",
    labels: { vi: "Bảng lương", en: "Payroll sheet" },
    ownerPositionKey: "warehouse-manager",
    permission: "labor.manageRecords",
    status: "planned",
  },
  // Factory Accountant / supplier coordination
  {
    key: "site-payables",
    labels: { vi: "Công nợ các cơ sở", en: "Payables by production site" },
    ownerPositionKey: "factory-accountant",
    permission: "payables.read",
    status: "planned",
  },
  {
    key: "lacquer-purchase",
    labels: { vi: "Mua sơn", en: "Lacquer purchase" },
    ownerPositionKey: "factory-accountant",
    permission: "procurement.create",
    status: "planned",
  },
  {
    key: "packaging-order",
    labels: { vi: "Đặt bao bì", en: "Packaging order" },
    ownerPositionKey: "factory-accountant",
    permission: "procurement.create",
    status: "planned",
  },
  // Company Accountant
  {
    key: "incoming-cash-report",
    labels: { vi: "Báo cáo tiền về", en: "Incoming cash report" },
    ownerPositionKey: "company-accountant",
    permission: "payments.read",
    status: "planned",
  },
  {
    key: "account-report",
    labels: { vi: "Báo cáo tài khoản", en: "Account report" },
    ownerPositionKey: "company-accountant",
    permission: "finance.readCost",
    status: "planned",
  },
  {
    key: "receivables-report",
    labels: { vi: "Báo cáo công nợ", en: "Receivables report" },
    ownerPositionKey: "company-accountant",
    permission: "receivables.read",
    status: "planned",
  },
  {
    key: "payroll-report",
    labels: { vi: "Báo cáo lương", en: "Payroll report" },
    ownerPositionKey: "company-accountant",
    permission: "labor.readSalary",
    status: "planned",
  },
  // Sample work moved to the Factory Manager when the Product Designer role
  // merged into FACTORY_MANAGER.
  {
    key: "sample-progress",
    labels: { vi: "Form tiến độ mẫu", en: "Sample progress form" },
    ownerPositionKey: "factory-manager",
    permission: "samples.update",
    status: "planned",
  },
  {
    key: "sample-order",
    labels: { vi: "Đơn hàng mẫu", en: "Sample order" },
    ownerPositionKey: "factory-manager",
    permission: "samples.create",
    status: "planned",
  },
  {
    key: "sample-handover",
    labels: { vi: "Giao mẫu", en: "Sample handover" },
    ownerPositionKey: "factory-manager",
    permission: "samples.addRevision",
    status: "planned",
  },
];

export function formsForPosition(
  positionKey: string,
): readonly OperationalForm[] {
  return operationalForms.filter(
    (form) => form.ownerPositionKey === positionKey,
  );
}

export function positionsForRole(
  roleKey: SystemRoleKey,
): readonly OrganizationPosition[] {
  return organizationPositions.filter((position) =>
    (position.roleKeys as readonly SystemRoleKey[]).includes(roleKey),
  );
}
