import type { PublicDictionary } from "../dictionary";

const dictionary = {
  meta: {
    siteTitle: "Cửa Đỏ Việt Nam | Sơn mài sống",
    siteDescription:
      "Bản xem trước DEMO cho trải nghiệm sơn mài công khai của Cửa Đỏ Việt Nam. Hãy thay nội dung và hình ảnh mẫu bằng tài liệu thương hiệu đã duyệt.",
  },
  common: {
    demoLabel: "Nội dung DEMO",
    skipToContent: "Chuyển đến nội dung chính",
    learnMore: "Tìm hiểu thêm",
    explore: "Khám phá",
    viewAll: "Xem tất cả",
    close: "Đóng",
    skipIntro: "Bỏ qua phần mở đầu",
    previous: "Trước",
    next: "Tiếp",
    openMenu: "Mở trình đơn",
    closeMenu: "Đóng trình đơn",
    language: "Ngôn ngữ",
    search: "Tìm kiếm",
    requestQuote: "Yêu cầu báo giá",
    readStory: "Đọc câu chuyện",
    featured: "Nổi bật",
    replaceContentNotice:
      "Nội dung DEMO — hãy thay bằng nội dung và hình ảnh đã được doanh nghiệp phê duyệt.",
  },
  nav: {
    home: "Trang chủ",
    about: "Về chúng tôi",
    products: "Sản phẩm",
    collections: "Bộ sưu tập",
    process: "Kỹ thuật sơn mài",
    news: "Tin tức",
    contact: "Liên hệ",
  },
  home: {
    eyebrow: "CỬA ĐỎ — SƠN MÀI SỐNG",
    title: "Bề mặt sống động,",
    titleAccent: "được tạo tác thủ công",
    intro:
      "Phần giới thiệu DEMO này dành chỗ cho câu chuyện thương hiệu Cửa Đỏ Việt Nam đã được phê duyệt.",
    craftTitle: "Câu chuyện vật liệu qua từng lớp",
    craftBody:
      "Đoạn nội dung biên tập DEMO dành cho hình ảnh xưởng, ghi chú quy trình và câu chuyện sản phẩm đã duyệt.",
    historyTitle: "Lịch sử công ty",
    featuredTitle: "Sản phẩm nổi bật",
    collectionsTitle: "Bộ sưu tập",
    processTitle: "Kỹ thuật sơn mài",
    newsTitle: "Ghi chép từ xưởng",
    contactTitle: "Bắt đầu cuộc trò chuyện",
    contactBody:
      "Hãy chia sẻ điều bạn đang tìm kiếm. Biểu mẫu chính thức sẽ chuyển yêu cầu đến bộ phận phù hợp.",
  },
  pages: {
    aboutTitle: "Về Cửa Đỏ",
    aboutIntro:
      "Khung nội dung DEMO dành cho câu chuyện, giá trị, con người và thông tin xưởng đã được xác minh.",
    productsTitle: "Sản phẩm",
    productsIntro:
      "Khám phá các bản ghi sản phẩm DEMO đang chờ được thay bằng dữ liệu catalogue đã duyệt.",
    collectionsTitle: "Bộ sưu tập",
    collectionsIntro:
      "Mở các bìa sách nghệ thuật DEMO trong khi năm phát hành, PDF và câu chuyện chính thức đang được chuẩn bị.",
    processTitle: "Kỹ thuật sơn mài",
    processIntro:
      "Trình tự DEMO cần được thay bằng vật liệu, công đoạn và thực hành tại xưởng đã được doanh nghiệp xác minh.",
    newsTitle: "Tin tức và câu chuyện",
    newsIntro:
      "Các bài biên tập DEMO tạo cấu trúc cho thông báo và câu chuyện được phê duyệt trong tương lai.",
    contactTitle: "Liên hệ và yêu cầu báo giá",
    contactIntro:
      "Hãy chia sẻ nội dung chính của yêu cầu. Thông tin liên hệ trong giai đoạn phát triển là dữ liệu mẫu nếu chưa được đánh dấu xác minh.",
    searchTitle: "Tìm kiếm",
    privacyTitle: "Chính sách quyền riêng tư",
    termsTitle: "Điều khoản sử dụng",
    accessibilityTitle: "Tuyên bố về khả năng tiếp cận",
  },
  about: {
    contentStatusLabel: "Trạng thái nội dung",
    contentStatusValue: "DEMO — đang chờ doanh nghiệp phê duyệt",
    claimsStatusLabel: "Thông tin thực tế",
    claimsStatusValue: "Không công bố khi chưa xác minh",
    assetStatusLabel: "Tài sản thương hiệu",
    assetStatusValue: "Đang chờ hình ảnh được phê duyệt",
    principlesDescription:
      "Các thẻ DEMO này xác định bằng chứng cần có trước khi công bố thông tin về doanh nghiệp.",
    principleKicker: "Nguyên tắc xuất bản",
    verifiedStoryTitle: "Câu chuyện doanh nghiệp đã xác minh",
    verifiedStoryDescription:
      "Ngày thành lập, cột mốc, khách hàng, giải thưởng và chứng nhận vẫn là nội dung chờ cho đến khi được nguồn có thẩm quyền xác nhận.",
    approvedCapabilitiesTitle: "Tuyên bố năng lực đã phê duyệt",
    approvedCapabilitiesDescription:
      "Thông tin về vật liệu, kỹ thuật, công suất và thời gian sản xuất chỉ xuất hiện sau khi doanh nghiệp cung cấp và phê duyệt.",
    documentedPeopleTitle: "Con người và xưởng được ghi nhận",
    documentedPeopleDescription:
      "Hồ sơ nghệ nhân, hình ảnh xưởng, tên và vai trò cần có sự đồng ý cùng nguồn tư liệu được phê duyệt trước khi xuất bản.",
    archiveNotice:
      "Mọi chương trong dòng thời gian đều được ghi nhãn DEMO và không sử dụng năm, giải thưởng, khách hàng hoặc chứng nhận chưa xác minh.",
  },
  product: {
    category: "Danh mục",
    collection: "Bộ sưu tập",
    material: "Vật liệu",
    finish: "Bề mặt hoàn thiện",
    dimensions: "Kích thước",
    leadTime: "Thời gian sản xuất",
    madeToOrder: "Sản xuất theo yêu cầu",
    story: "Câu chuyện sản phẩm",
    specifications: "Thông số",
    related: "Sản phẩm liên quan",
    filters: "Bộ lọc",
    sort: "Sắp xếp",
    sortDefault: "Thứ tự tuyển chọn",
    sortFeatured: "Nổi bật trước",
    sortNameAscending: "Tên A–Z",
    sortNameDescending: "Tên Z–A",
    page: "Trang",
    zoomImage: "Xem ảnh kích thước đầy đủ",
    zoomUnavailable: "Ảnh kích thước đầy đủ đang chờ bổ sung",
    video: "Video sản phẩm",
    videoUnavailable: "Chưa có video sản phẩm được duyệt trong bản DEMO này.",
    variants: "Biến thể",
    variantsUnavailable:
      "Chưa có biến thể sản phẩm được duyệt trong bản DEMO này.",
    process: "Quy trình chế tác",
    processUnavailable:
      "Chưa có ghi chú quy trình chế tác được duyệt trong bản DEMO này.",
    noPrice: "Liên hệ để nhận báo giá",
  },
  collection: {
    openBook: "Mở sách nghệ thuật",
    viewProducts: "Xem sản phẩm",
    download: "Tải PDF",
    downloadDisabled: "Chưa thể tải PDF cho bộ sưu tập DEMO này",
  },
  news: {
    published: "Đăng ngày",
    by: "Tác giả",
    related: "Câu chuyện liên quan",
    share: "Chia sẻ câu chuyện này",
    shareNative: "Chia sẻ",
    copyLink: "Sao chép liên kết",
    copySuccess: "Đã sao chép liên kết",
    copyFailed: "Không thể sao chép liên kết",
    shareFacebook: "Chia sẻ lên Facebook",
    shareLinkedIn: "Chia sẻ lên LinkedIn",
    shareEmail: "Chia sẻ qua email",
  },
  contact: {
    fullName: "Họ và tên",
    company: "Công ty",
    email: "Email",
    phone: "Điện thoại",
    country: "Quốc gia hoặc khu vực",
    countrySelect: "Chọn quốc gia hoặc khu vực",
    countryOther: "Quốc gia hoặc khu vực khác",
    interests: "Sản phẩm hoặc bộ sưu tập quan tâm",
    quantity: "Số lượng dự kiến",
    deadline: "Thời hạn mong muốn",
    notes: "Ghi chú",
    attachment: "Tệp đính kèm không bắt buộc",
    attachmentHelp:
      "Chỉ dành cho DEMO — chức năng chọn và tải tệp đang tắt. Khi được bật, hệ thống sẽ nhận PDF, JPG, PNG hoặc WebP tối đa 10 MB; không gửi dữ liệu cá nhân nhạy cảm.",
    mapTitle: "Bản đồ",
    mapDescription:
      "Bản đồ chỉ tải khi bạn bấm, để trang không phải gọi tới máy chủ bên thứ ba ngay từ đầu.",
    loadMap: "Tải bản đồ",
    mapUnavailable:
      "Không tải được bản đồ. Bạn có thể mở trực tiếp trong Google Maps.",
    openInMaps: "Mở trong Google Maps",
    consent:
      "Tôi đồng ý để thông tin của mình được sử dụng nhằm phản hồi yêu cầu này.",
    submit: "Gửi yêu cầu",
    demoNotice:
      "Biểu mẫu DEMO — quy trình lưu yêu cầu và gửi thông báo sẽ được kích hoạt ở phase sau.",
    fax: "Fax",
    officeAddress: "Văn phòng",
    factoryAddress: "Nhà máy",
    warehouseAddress: "Kho hàng",
  },
  footer: {
    description:
      "Trải nghiệm thương hiệu DEMO cho Cửa Đỏ Việt Nam. Hãy thay toàn bộ nội dung và thông tin liên hệ mẫu trước khi ra mắt.",
    navigate: "Điều hướng",
    legal: "Pháp lý",
    privacy: "Quyền riêng tư",
    terms: "Điều khoản",
    accessibility: "Khả năng tiếp cận",
    copyright: "© Cửa Đỏ Việt Nam. Bảo lưu mọi quyền.",
  },
} satisfies PublicDictionary;

export default dictionary;
