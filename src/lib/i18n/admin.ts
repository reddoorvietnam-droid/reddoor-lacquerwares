import type { Locale } from "@/lib/i18n/config";

export const adminLocales = ["vi", "en"] as const;
export type AdminLocale = (typeof adminLocales)[number];

type AdminCopy = {
  productName: string;
  consoleLabel: string;
  openPublicSite: string;
  navigationLabel: string;
  navigation: {
    overview: string;
    operations: string;
    approvals: string;
    organization: string;
    content: string;
    products: string;
    news: string;
    collections: string;
    settings: string;
  };
  operations: {
    eyebrow: string;
    title: string;
    description: string;
    stageColumn: string;
    stepColumn: string;
    ownerColumn: string;
    permissionColumn: string;
    approvalColumn: string;
    approvalRequired: string;
    approvalNone: string;
    branches: string;
    branchesDescription: string;
    guards: string;
    guardList: readonly string[];
    notImplemented: string;
  };
  approvals: {
    eyebrow: string;
    title: string;
    description: string;
    rule: string;
    subjectColumn: string;
    deciderColumn: string;
    separationTitle: string;
    separationDescription: string;
    notImplemented: string;
  };
  organization: {
    eyebrow: string;
    title: string;
    description: string;
    positionColumn: string;
    rolesColumn: string;
    responsibilitiesColumn: string;
    dataColumn: string;
    formsTitle: string;
    formsDescription: string;
    formColumn: string;
    ownerColumn: string;
    statusColumn: string;
    statusAvailable: string;
    statusPlanned: string;
    visibilityTitle: string;
    visibilityDescription: string;
  };
  overview: {
    eyebrow: string;
    title: string;
    description: string;
    secureBoundary: string;
    secureBoundaryDescription: string;
    workflow: string;
    workflowDescription: string;
    translations: string;
    translationsDescription: string;
    openContent: string;
  };
  content: {
    eyebrow: string;
    title: string;
    description: string;
    create: string;
    searchLabel: string;
    searchPlaceholder: string;
    empty: string;
    columns: {
      entry: string;
      placement: string;
      workflow: string;
      translations: string;
      updated: string;
      action: string;
    };
    edit: string;
    translationProgress: string;
  };
  workflow: Record<
    "draft" | "inReview" | "published" | "archived" | "needsUpdate",
    string
  >;
  editor: {
    createEyebrow: string;
    editEyebrow: string;
    createTitle: string;
    editTitle: string;
    detailsLegend: string;
    code: string;
    codeHelp: string;
    type: string;
    placement: string;
    sourceLocale: string;
    translationsLegend: string;
    translationHelp: string;
    title: string;
    slug: string;
    slugHelp: string;
    summary: string;
    body: string;
    bodyHelp: string;
    seoLegend: string;
    seoTitle: string;
    seoDescription: string;
    noIndex: string;
    save: string;
    saving: string;
    required: string;
    unsupportedBlocks: string;
    types: Record<"page" | "section" | "processStage" | "global", string>;
  };
  auth: {
    eyebrow: string;
    title: string;
    description: string;
    googleButton: string;
    privacyNote: string;
    pendingTitle: string;
    pendingDescription: string;
    suspendedTitle: string;
    suspendedDescription: string;
    deniedTitle: string;
    deniedDescription: string;
    staleTitle: string;
    staleDescription: string;
    unavailableTitle: string;
    unavailableDescription: string;
    signInAgain: string;
  };
  state: {
    loading: string;
    unexpectedTitle: string;
    unexpectedDescription: string;
    retry: string;
    notFoundTitle: string;
    notFoundDescription: string;
    backToAdmin: string;
  };
  actions: {
    invalid: string;
    denied: string;
    notFound: string;
    conflict: string;
    committedWarning: string;
    unexpected: string;
    saved: string;
    submitted: string;
    returned: string;
    published: string;
  };
  workflowActions: {
    title: string;
    description: string;
    submitReview: string;
    submitting: string;
    returnDraft: string;
    returning: string;
    returnReason: string;
    returnReasonPlaceholder: string;
    publish: string;
    publishing: string;
    createRevision: string;
    creatingRevision: string;
    immutable: string;
  };
  setup: {
    eyebrow: string;
    title: string;
    description: string;
    mongo: string;
    auth: string;
    safeDefault: string;
  };
};

const adminDictionaries = {
  vi: {
    productName: "Cửa Đỏ Việt Nam",
    consoleLabel: "Cổng quản trị",
    openPublicSite: "Mở website",
    navigationLabel: "Điều hướng quản trị",
    navigation: {
      overview: "Tổng quan",
      operations: "Quy trình đơn hàng",
      approvals: "Phê duyệt",
      organization: "Cơ cấu tổ chức",
      content: "Nội dung",
      products: "Sản phẩm",
      news: "Tin tức",
      collections: "Bộ sưu tập",
      settings: "Thiết lập",
    },
    operations: {
      eyebrow: "Quy trình vận hành",
      title: "Mười lăm bước của một đơn hàng",
      description:
        "Sơ đồ dưới đây là quy trình đã được chốt, đang được mã hóa thành máy trạng thái. Mỗi bước ghi rõ vị trí chịu trách nhiệm, quyền cần có để rời bước và điểm bắt buộc Giám đốc phê duyệt.",
      stageColumn: "Bước",
      stepColumn: "STT",
      ownerColumn: "Vị trí phụ trách",
      permissionColumn: "Quyền để chuyển bước",
      approvalColumn: "Giám đốc duyệt",
      approvalRequired: "Bắt buộc",
      approvalNone: "Không",
      branches: "Hai nhánh rẽ",
      branchesDescription:
        "Thiếu nguyên liệu thì đơn hàng chuyển sang đặt mua rồi quay lại kiểm tra tồn kho. Kiểm tra chất lượng không đạt thì đơn hàng quay lại sản xuất để khắc phục, kèm lý do bắt buộc.",
      guards: "Ràng buộc bắt buộc",
      guardList: [
        "Không cho nhảy bước ngoài sơ đồ.",
        "Đơn đã đóng hoặc đã hủy không thể chuyển tiếp.",
        "Bước có cổng duyệt phải có quyết định phê duyệt còn hiệu lực.",
        "Chưa đạt kiểm tra chất lượng thì không được đóng gói.",
        "Hủy đơn và trả về khắc phục đều bắt buộc ghi lý do.",
      ],
      notImplemented:
        "Trang này hiển thị quy trình đã được mã hóa. Việc lưu đơn hàng thật, gán đơn vị thực hiện và ghi audit thuộc bước triển khai tiếp theo và chưa hoạt động.",
    },
    approvals: {
      eyebrow: "Cổng phê duyệt",
      title: "Giám đốc phê duyệt toàn bộ",
      description:
        "Theo yêu cầu đã chốt, mọi nghiệp vụ trọng yếu đều phải qua Giám đốc. Nắm quyền thực hiện một thao tác không đồng nghĩa được hoàn tất thao tác đó: hệ thống giữ yêu cầu ở trạng thái chờ cho đến khi có quyết định.",
      rule: "Đơn hàng, giá bán, thay đổi giá, mua nguyên liệu, chi phí phát sinh, xuất hàng — tất cả.",
      subjectColumn: "Nội dung cần duyệt",
      deciderColumn: "Quyền quyết định",
      separationTitle: "Tách bạch trách nhiệm",
      separationDescription:
        "Người gửi yêu cầu không bao giờ là người duyệt, kể cả Giám đốc tự gửi. Từ chối bắt buộc ghi lý do, và nếu bản ghi gốc thay đổi sau khi duyệt thì phải trình duyệt lại.",
      notImplemented:
        "Danh sách dưới đây là các loại phê duyệt đã được mã hóa. Hàng đợi phê duyệt có dữ liệu thật chưa được triển khai.",
    },
    organization: {
      eyebrow: "Cơ cấu tổ chức",
      title: "Vị trí, trách nhiệm và dữ liệu phụ trách",
      description:
        "Hệ thống mô tả vị trí công việc chứ không gắn cứng tên người. Bàn giao công việc là thay đổi việc cấp quyền, không phải sửa mã nguồn.",
      positionColumn: "Vị trí",
      rolesColumn: "Role được cấp",
      responsibilitiesColumn: "Trách nhiệm",
      dataColumn: "Dữ liệu phụ trách",
      formsTitle: "Biểu mẫu đang dùng tại công ty",
      formsDescription:
        "Các biểu mẫu được yêu cầu dựng lại trong hệ thống. Trạng thái dưới đây phản ánh trung thực phần đã có màn hình và phần mới chỉ có định nghĩa.",
      formColumn: "Biểu mẫu",
      ownerColumn: "Vị trí phụ trách",
      statusColumn: "Trạng thái",
      statusAvailable: "Đã có màn hình",
      statusPlanned: "Mới có định nghĩa",
      visibilityTitle: "Quy tắc xem giá",
      visibilityDescription:
        "Giá bán, biên lợi nhuận và lợi nhuận chỉ Giám đốc và Kế toán công ty được xem. Giá mua và các phần dữ liệu vận hành còn lại thì mọi vị trí đều xem được; quyền chỉnh sửa phải được cấp riêng.",
    },
    overview: {
      eyebrow: "Tổng quan vận hành",
      title: "Không gian làm việc nội dung",
      description:
        "Mọi dữ liệu trên trang này đều được đọc sau khi phiên, trạng thái tài khoản, role và scope được kiểm tra lại trên máy chủ.",
      secureBoundary: "Biên bảo vệ",
      secureBoundaryDescription:
        "Google OAuth, trạng thái pending/active/suspended và quyền hiệu lực đều fail-closed.",
      workflow: "Quy trình xuất bản",
      workflowDescription:
        "Bản nháp phải qua duyệt; publish cập nhật pointer và route trong cùng transaction.",
      translations: "Chất lượng bản dịch",
      translationsDescription:
        "Sáu locale có trạng thái độc lập; bản rỗng hoặc chưa duyệt luôn noindex.",
      openContent: "Mở Content Studio",
    },
    content: {
      eyebrow: "Content Studio",
      title: "Nội dung thương hiệu",
      description:
        "Quản lý bản nháp, vòng duyệt và trạng thái sáu bản dịch trước khi xuất bản.",
      create: "Tạo nội dung",
      searchLabel: "Tìm nội dung",
      searchPlaceholder: "Tìm theo mã, tiêu đề hoặc vị trí…",
      empty: "Không có nội dung phù hợp.",
      columns: {
        entry: "Nội dung",
        placement: "Vị trí",
        workflow: "Quy trình",
        translations: "Bản dịch",
        updated: "Cập nhật",
        action: "Thao tác",
      },
      edit: "Biên tập",
      translationProgress: "bản đã xuất bản",
    },
    workflow: {
      draft: "Bản nháp",
      inReview: "Đang duyệt",
      published: "Đã xuất bản",
      archived: "Đã lưu trữ",
      needsUpdate: "Cần cập nhật",
    },
    editor: {
      createEyebrow: "Nội dung mới",
      editEyebrow: "Biên tập bản nháp",
      createTitle: "Tạo nội dung có cấu trúc",
      editTitle: "Cập nhật nội dung có cấu trúc",
      detailsLegend: "Thông tin chung",
      code: "Mã nội dung",
      codeHelp:
        "Mã ổn định dạng chữ-thường-gạch-ngang; không đổi theo bản dịch.",
      type: "Loại nội dung",
      placement: "Vị trí hiển thị",
      sourceLocale: "Ngôn ngữ nguồn",
      translationsLegend: "Sáu bản dịch",
      translationHelp:
        "Mỗi bản dịch có trạng thái riêng. Bản rỗng hoặc chưa được duyệt sẽ không được index.",
      title: "Tiêu đề",
      slug: "Slug",
      slugHelp: "Chỉ bắt buộc với nội dung sở hữu URL công khai.",
      summary: "Tóm tắt",
      body: "Nội dung văn bản",
      bodyHelp:
        "Mỗi đoạn cách nhau bằng một dòng trống sẽ được lưu thành block paragraph; không lưu HTML tùy ý.",
      seoLegend: "SEO",
      seoTitle: "Tiêu đề SEO",
      seoDescription: "Mô tả SEO",
      noIndex: "Không cho công cụ tìm kiếm index bản dịch này",
      save: "Lưu bản nháp",
      saving: "Đang lưu…",
      required: "Trường này là bắt buộc.",
      unsupportedBlocks:
        "Bản nháp này có loại block chưa được trình biên tập văn bản hỗ trợ. Chức năng lưu đã khóa để tránh mất dữ liệu; dùng trình biên tập block chuyên dụng ở bước tiếp theo.",
      types: {
        page: "Trang",
        section: "Section",
        processStage: "Công đoạn",
        global: "Nội dung dùng chung",
      },
    },
    auth: {
      eyebrow: "Truy cập nội bộ",
      title: "Đăng nhập Cổng quản trị",
      description:
        "Dùng tài khoản Google đã được cấp quyền. Tài khoản mới luôn ở trạng thái chờ duyệt và chưa thể đọc dữ liệu nội bộ.",
      googleButton: "Tiếp tục với Google",
      privacyNote:
        "Hệ thống chỉ lưu định danh cần thiết cho xác thực và phân quyền; không lưu token Google trong nội dung CMS.",
      pendingTitle: "Tài khoản đang chờ duyệt",
      pendingDescription:
        "Đăng nhập đã thành công nhưng quyền truy cập chưa được một quản trị viên kích hoạt.",
      suspendedTitle: "Tài khoản đã bị tạm ngưng",
      suspendedDescription:
        "Mọi quyền quản trị hiện bị từ chối. Liên hệ quản trị viên nội bộ để được hỗ trợ.",
      deniedTitle: "Bạn chưa có quyền xem khu vực này",
      deniedDescription:
        "Quyền được kiểm tra lại trên máy chủ cho mỗi lượt đọc và thay đổi dữ liệu.",
      staleTitle: "Phiên đăng nhập cần làm mới",
      staleDescription:
        "Phân quyền của tài khoản đã thay đổi kể từ khi phiên này được tạo.",
      unavailableTitle: "Chưa thể kiểm tra quyền truy cập",
      unavailableDescription:
        "Kho dữ liệu phân quyền tạm thời không phản hồi. Hệ thống đã từ chối truy cập theo mặc định.",
      signInAgain: "Đăng nhập lại",
    },
    state: {
      loading: "Đang tải không gian quản trị…",
      unexpectedTitle: "Không thể hoàn tất yêu cầu",
      unexpectedDescription:
        "Hệ thống đã dừng an toàn và không hiển thị chi tiết lỗi. Bạn có thể thử lại; nếu lỗi lặp lại, cung cấp mã sự cố cho quản trị viên.",
      retry: "Thử lại",
      notFoundTitle: "Không tìm thấy trang quản trị",
      notFoundDescription:
        "Đường dẫn này không tồn tại hoặc không còn thuộc khu vực được hỗ trợ.",
      backToAdmin: "Về trang quản trị",
    },
    actions: {
      invalid: "Một số trường chưa hợp lệ. Kiểm tra nội dung và thử lại.",
      denied: "Bạn không có quyền thực hiện thao tác này.",
      notFound: "Không tìm thấy bản nội dung được yêu cầu.",
      conflict:
        "Nội dung đã thay đổi ở một phiên khác. Tải lại trang trước khi tiếp tục.",
      committedWarning:
        "Dữ liệu đã được lưu, nhưng audit hoặc làm mới cache chưa hoàn tất. Không gửi lại thao tác; hãy báo quản trị viên.",
      unexpected:
        "Không thể hoàn tất thao tác. Không có dữ liệu nhạy cảm nào được hiển thị.",
      saved: "Đã lưu bản nháp.",
      submitted: "Đã gửi bản nháp để duyệt.",
      returned: "Đã trả nội dung về bản nháp.",
      published: "Đã xuất bản nội dung.",
    },
    workflowActions: {
      title: "Cổng kiểm soát xuất bản",
      description:
        "Mỗi thao tác kiểm tra lại quyền, revision hiện tại và trạng thái của toàn bộ bản dịch trên máy chủ.",
      submitReview: "Gửi duyệt",
      submitting: "Đang gửi…",
      returnDraft: "Trả về bản nháp",
      returning: "Đang trả về…",
      returnReason: "Lý do cần chỉnh sửa",
      returnReasonPlaceholder:
        "Mô tả thay đổi bắt buộc trước khi gửi duyệt lại…",
      publish: "Duyệt và xuất bản",
      publishing: "Đang xuất bản…",
      createRevision: "Tạo revision mới",
      creatingRevision: "Đang tạo revision…",
      immutable:
        "Phiên bản đã xuất bản là bất biến. Tạo revision mới để tiếp tục chỉnh sửa.",
    },
    setup: {
      eyebrow: "Thiết lập bắt buộc",
      title: "CMS đang khóa an toàn",
      description:
        "Cổng quản trị chỉ mở khi MongoDB và Google OAuth được cấu hình hợp lệ. Dữ liệu DEMO của website công khai không thể bị sửa như dữ liệu thật.",
      mongo: "Khai báo MONGODB_URI trực tiếp trong .env.local hoặc Vercel.",
      auth: "Khai báo AUTH_SECRET, AUTH_GOOGLE_ID và AUTH_GOOGLE_SECRET.",
      safeDefault:
        "Khi thiếu cấu hình, mọi đọc/ghi quản trị đều bị từ chối theo mặc định.",
    },
  },
  en: {
    productName: "Red Door Vietnam",
    consoleLabel: "Administration portal",
    openPublicSite: "Open public site",
    navigationLabel: "Administration navigation",
    navigation: {
      overview: "Overview",
      operations: "Order process",
      approvals: "Approvals",
      organization: "Organisation",
      content: "Content",
      products: "Products",
      news: "News",
      collections: "Collections",
      settings: "Settings",
    },
    operations: {
      eyebrow: "Operating process",
      title: "The fifteen steps of an order",
      description:
        "The chart below is the agreed process, encoded as a state machine. Each step names the position accountable for it, the permission required to leave it, and whether the Director must approve before it advances.",
      stageColumn: "Stage",
      stepColumn: "No.",
      ownerColumn: "Accountable position",
      permissionColumn: "Permission to advance",
      approvalColumn: "Director approval",
      approvalRequired: "Required",
      approvalNone: "None",
      branches: "Two branches",
      branchesDescription:
        "A material shortage moves the order to purchasing and back to the inventory check. A failed inspection returns the order to production for rework, with a mandatory reason.",
      guards: "Enforced guards",
      guardList: [
        "A move outside the chart is refused.",
        "A closed or cancelled order cannot advance.",
        "A gated stage needs a valid approval decision.",
        "Packing is blocked until quality control passes.",
        "Cancellation and rework must both record a reason.",
      ],
      notImplemented:
        "This page shows the encoded process. Persisting real orders, assigning executing units, and writing audit records belong to the next implementation step and are not live.",
    },
    approvals: {
      eyebrow: "Approval gate",
      title: "The Director approves everything",
      description:
        "As confirmed, every significant operation passes through the Director. Holding the permission to perform an action does not mean it can be completed: the system parks the request until a decision exists.",
      rule: "Orders, selling price, price changes, material purchases, incurred expenses, dispatch — all of them.",
      subjectColumn: "Subject",
      deciderColumn: "Permission to decide",
      separationTitle: "Separation of duties",
      separationDescription:
        "The person who raised a request is never the person who releases it, even when the Director raises it. A rejection must record a reason, and if the underlying record changes after approval it must be approved again.",
      notImplemented:
        "The list below shows the encoded approval subjects. A queue backed by real records is not implemented yet.",
    },
    organization: {
      eyebrow: "Organisation",
      title: "Positions, responsibilities, and owned data",
      description:
        "The system describes positions rather than hard-coding names. A handover is a change to a grant, not a change to source code.",
      positionColumn: "Position",
      rolesColumn: "Roles granted",
      responsibilitiesColumn: "Responsibilities",
      dataColumn: "Data owned",
      formsTitle: "Forms the company runs on",
      formsDescription:
        "The forms requested for rebuilding in the system. The status below is honest about which have a screen and which exist only as a definition.",
      formColumn: "Form",
      ownerColumn: "Accountable position",
      statusColumn: "Status",
      statusAvailable: "Screen built",
      statusPlanned: "Definition only",
      visibilityTitle: "Price visibility rule",
      visibilityDescription:
        "Selling price, margin, and profit are visible only to the Director and the Company Accountant. Purchase price and the remaining operational data are readable by every position; the right to edit is granted separately.",
    },
    overview: {
      eyebrow: "Operations overview",
      title: "Content workspace",
      description:
        "Every record on this page is read only after the session, account status, roles, and effective scope are rechecked on the server.",
      secureBoundary: "Secure boundary",
      secureBoundaryDescription:
        "Google OAuth, pending/active/suspended states, and effective permissions all fail closed.",
      workflow: "Publishing workflow",
      workflowDescription:
        "Drafts pass review; publication updates the pointer and route in one transaction.",
      translations: "Translation quality",
      translationsDescription:
        "Six locales have independent status; empty or unreviewed content is always noindex.",
      openContent: "Open Content Studio",
    },
    content: {
      eyebrow: "Content Studio",
      title: "Brand content",
      description:
        "Manage drafts, review gates, and all six translation states before publication.",
      create: "Create content",
      searchLabel: "Search content",
      searchPlaceholder: "Search by code, title, or placement…",
      empty: "No content matches this search.",
      columns: {
        entry: "Entry",
        placement: "Placement",
        workflow: "Workflow",
        translations: "Translations",
        updated: "Updated",
        action: "Action",
      },
      edit: "Edit",
      translationProgress: "translations published",
    },
    workflow: {
      draft: "Draft",
      inReview: "In review",
      published: "Published",
      archived: "Archived",
      needsUpdate: "Needs update",
    },
    editor: {
      createEyebrow: "New content",
      editEyebrow: "Edit draft",
      createTitle: "Create structured content",
      editTitle: "Update structured content",
      detailsLegend: "Entry details",
      code: "Content code",
      codeHelp:
        "A stable lowercase-hyphen code that does not change by locale.",
      type: "Content type",
      placement: "Display placement",
      sourceLocale: "Source language",
      translationsLegend: "Six translations",
      translationHelp:
        "Each translation has its own status. Empty or unreviewed translations are never indexed.",
      title: "Title",
      slug: "Slug",
      slugHelp: "Required only when this content owns a public URL.",
      summary: "Summary",
      body: "Body copy",
      bodyHelp:
        "Paragraphs separated by a blank line are persisted as paragraph blocks; arbitrary HTML is not stored.",
      seoLegend: "SEO",
      seoTitle: "SEO title",
      seoDescription: "SEO description",
      noIndex: "Prevent search engines from indexing this translation",
      save: "Save draft",
      saving: "Saving…",
      required: "This field is required.",
      unsupportedBlocks:
        "This draft contains block types the text editor does not expose. Saving is locked to prevent data loss; use the dedicated block editor in the next step.",
      types: {
        page: "Page",
        section: "Section",
        processStage: "Process stage",
        global: "Global content",
      },
    },
    auth: {
      eyebrow: "Internal access",
      title: "Sign in to the administration portal",
      description:
        "Use an authorized Google account. New accounts always remain pending and cannot read internal data until approved.",
      googleButton: "Continue with Google",
      privacyNote:
        "Only identity data needed for authentication and authorization is stored; Google tokens are never persisted in CMS content.",
      pendingTitle: "Account awaiting approval",
      pendingDescription:
        "Sign-in succeeded, but an administrator has not activated this account yet.",
      suspendedTitle: "Account suspended",
      suspendedDescription:
        "All administration access is currently denied. Contact an internal administrator for support.",
      deniedTitle: "You do not have access to this area",
      deniedDescription:
        "Permissions are rechecked on the server for every sensitive read and mutation.",
      staleTitle: "Your session must be refreshed",
      staleDescription:
        "This account's authorization changed after the current session was issued.",
      unavailableTitle: "Authorization cannot be verified",
      unavailableDescription:
        "The authorization store is temporarily unavailable. Access has been denied by default.",
      signInAgain: "Sign in again",
    },
    state: {
      loading: "Loading the administration workspace…",
      unexpectedTitle: "The request could not be completed",
      unexpectedDescription:
        "The operation stopped safely and no error details were exposed. Try again; if it repeats, give the incident code to an administrator.",
      retry: "Try again",
      notFoundTitle: "Administration page not found",
      notFoundDescription:
        "This path does not exist or is no longer part of the supported workspace.",
      backToAdmin: "Back to administration",
    },
    actions: {
      invalid: "Some fields are invalid. Review the content and try again.",
      denied: "You do not have permission to perform this action.",
      notFound: "The requested content record could not be found.",
      conflict:
        "This content changed in another session. Reload the page before continuing.",
      committedWarning:
        "The data was saved, but audit or cache refresh did not finish. Do not resubmit; notify an administrator.",
      unexpected:
        "The operation could not be completed. No sensitive details were exposed.",
      saved: "Draft saved.",
      submitted: "Draft submitted for review.",
      returned: "Content returned to draft.",
      published: "Content published.",
    },
    workflowActions: {
      title: "Publication gate",
      description:
        "Every action rechecks permission, the current revision, and every translation state on the server.",
      submitReview: "Submit for review",
      submitting: "Submitting…",
      returnDraft: "Return to draft",
      returning: "Returning…",
      returnReason: "Required changes",
      returnReasonPlaceholder:
        "Describe what must change before the next review…",
      publish: "Approve and publish",
      publishing: "Publishing…",
      createRevision: "Create new revision",
      creatingRevision: "Creating revision…",
      immutable:
        "Published versions are immutable. Create a new revision to continue editing.",
    },
    setup: {
      eyebrow: "Required setup",
      title: "The CMS is safely locked",
      description:
        "The administration portal opens only after MongoDB and Google OAuth are configured. Public DEMO records can never be edited as if they were persisted content.",
      mongo: "Set MONGODB_URI directly in .env.local or Vercel.",
      auth: "Set AUTH_SECRET, AUTH_GOOGLE_ID, and AUTH_GOOGLE_SECRET.",
      safeDefault:
        "Without configuration, all administration reads and writes are denied by default.",
    },
  },
} as const satisfies Record<AdminLocale, AdminCopy>;

export function resolveAdminLocale(locale: Locale): AdminLocale {
  return locale === "vi" ? "vi" : "en";
}

export function getAdminDictionary(locale: AdminLocale): AdminCopy {
  return adminDictionaries[locale];
}
