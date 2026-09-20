import type { Permission } from "@/domains/identity/permissions";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";

/**
 * The company's operating structure, expressed as positions rather than people.
 *
 * The organisation chart names individuals; this registry deliberately does not.
 * A position is filled by granting its role to a user, so a handover is a grant
 * change and never a code change.
 *
 * Sources: the task sheet "Phân công nhiệm vụ" and the production procedure
 * SOP-SX-001 the Director confirmed on 2026-09-14, plus the working-group
 * thread in which each position stated the data it owns and the paper forms
 * it needs rebuilt in the system.
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
        "Quản lý chung",
        "Quản trị hệ thống và người dùng",
        "Xác nhận đơn hàng, duyệt mua vật tư và mọi việc liên quan đến bán hàng, chi trả",
        "Đóng hồ sơ đơn hàng; người duy nhất xem lợi nhuận",
        "Quản lý và xuất bản nội dung website",
      ],
      en: [
        "General management",
        "Platform and user administration",
        "Confirms orders, approves material purchases and everything to do with selling and paying",
        "Closes the order file; the only reader of profit",
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
        "Quản lý trả lương công nhân",
        "Quản lý các báo cáo thuế, bảo hiểm",
        "Quản lý nhập khẩu hàng hóa, tờ khai nhập",
        "Quản lý xuất khẩu hàng hóa, tờ khai xuất và bộ chứng từ sau khi hàng đi",
        "Quản lý thanh toán cơ sở",
        "Khách hàng, tiền khách trả và công nợ",
        "Quản lý công việc hành chính",
      ],
      en: [
        "Worker payroll",
        "Tax and insurance reporting",
        "Imports and import declarations",
        "Exports, export declarations and the post-shipment document set",
        "Payments to production sites",
        "Customers, customer money and receivables",
        "Administrative work",
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
        "Nhận đơn hàng, ký hợp đồng mua hàng từ cơ sở",
        "Theo dõi tiến độ giao hàng: bao bì, mộc, hoàn thiện",
        "Lập kế hoạch sản xuất và xác nhận mẫu",
        "Quản lý chất lượng: kiểm mộc, kiểm hoàn thiện, kiểm đóng gói",
        "Nhận giao hàng",
      ],
      en: [
        "Receives orders and signs purchase contracts with production sites",
        "Tracks delivery progress: packaging, woodwork, finishing",
        "Production planning and sample confirmation",
        "Quality: raw-body, finishing and packing inspections",
        "Receives deliveries",
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
        "Quản lý công nợ các hợp đồng mua hàng cơ sở",
        "Làm tem mác các hợp đồng mua hàng cơ sở",
        "Làm PKL các hợp đồng xuất khẩu",
        "Làm INV các hợp đồng xuất khẩu",
        "Ghi chi phí thực tế theo đơn hàng",
      ],
      en: [
        "Payables on purchase contracts with production sites",
        "Labels for purchase contracts with production sites",
        "PKL for export contracts",
        "INV for export contracts",
        "Actual costs per order",
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
        "Quản lý kho: kho sơn, kho gỗ, kho phụ kiện",
        "Quản lý công nhân: chấm công",
        "Đặt mua nguyên liệu: sơn, gỗ, bao bì, vật liệu phụ",
        "Bán hàng lẻ",
        "Cấp vật tư, đóng gói và xuất hàng theo đơn",
      ],
      en: [
        "Warehouses: lacquer, wood, accessories",
        "Workers: attendance",
        "Purchases materials: lacquer, wood, packaging, consumables",
        "Retail sales",
        "Issues material, packs and dispatches per order",
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
    permission: "facilityContracts.manage",
    status: "available",
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
    permission: "facilityContracts.read",
    status: "available",
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
