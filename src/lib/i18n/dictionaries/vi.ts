import type { PublicDictionary } from "../dictionary";

const dictionary = {
  meta: {
    siteName: "Red Door",
    siteTitle: "Red Door — Sơn mài thủ công Việt Nam",
    siteDescription:
      "Red Door chế tác đồ sơn mài thủ công — Nghệ thuật sơn mài Việt Nam: khay, hộp, lót ly và đồ trang trí nội thất được phủ nhiều lớp sơn, mài nước và đánh bóng bằng tay. Sản phẩm kiểm định SGS theo tiêu chuẩn châu Âu, xuất khẩu đi Mỹ và châu Âu.",
  },
  common: {
    updatingLabel: "Đang cập nhật",
    skipToContent: "Chuyển đến nội dung chính",
    learnMore: "Tìm hiểu thêm",
    explore: "Khám phá",
    viewAll: "Xem tất cả",
    close: "Đóng",
    previous: "Trước",
    next: "Tiếp",
    openMenu: "Mở trình đơn",
    closeMenu: "Đóng trình đơn",
    language: "Ngôn ngữ",
    search: "Tìm kiếm",
    requestQuote: "Yêu cầu báo giá",
    readStory: "Đọc câu chuyện",
    featured: "Nổi bật",
    playVideo: "Phát video",
    updatingNotice: "Nội dung của mục này đang được xưởng hoàn thiện.",
  },
  nav: {
    home: "Trang chủ",
    about: "Về chúng tôi",
    products: "Sản phẩm",
    collections: "Bộ sưu tập",
    process: "Kỹ thuật sơn mài",
    news: "Tin tức",
    shop: "Cửa hàng",
    contact: "Liên hệ",
  },
  home: {
    eyebrow: "RED DOOR — SƠN MÀI SỐNG",
    title: "Bề mặt sống động,",
    titleAccent: "được tạo tác thủ công",
    heroDescription:
      "Tinh hoa sơn mài Việt được gìn giữ qua từng lớp sơn, mỗi sản phẩm là sự hòa quyện giữa thiên nhiên và bàn tay nghệ nhân.",
    craftTitle: "Câu chuyện vật liệu qua từng lớp",
    craftBody:
      "Từ tấm vóc đầu tiên đến lớp sơn cuối cùng, mỗi món đồ Red Door đi qua hàng chục công đoạn và nhiều tuần chờ sơn khô tự nhiên. Chúng tôi phủ, mài nước rồi lại phủ — cho đến khi mặt sơn sâu và trong như mặt nước lặng.",
    historyTitle: "Hành trình của xưởng",
    featuredTitle: "Sản phẩm nổi bật",
    collectionsTitle: "Bộ sưu tập",
    processTitle: "Kỹ thuật sơn mài",
    newsTitle: "Ghi chép từ xưởng",
    contactTitle: "Bắt đầu cuộc trò chuyện",
    contactBody:
      "Hãy cho chúng tôi biết bạn đang tìm kiếm điều gì — một bộ sưu tập có sẵn, một thiết kế riêng hay một đơn hàng xuất khẩu. Đội ngũ Red Door sẽ phản hồi sớm nhất có thể.",
  },
  pages: {
    aboutTitle: "Về chúng tôi",
    aboutIntro:
      "Red Door gìn giữ và phát triển Nghệ thuật sơn mài Việt Nam — nơi nghề sơn mài được trao truyền qua nhiều thế hệ. Chúng tôi kết hợp kỹ thuật cổ truyền với thiết kế đương đại để đưa sơn mài Việt Nam đến những không gian sống trên khắp thế giới.",
    productsTitle: "Sản phẩm",
    productsIntro:
      "Khay, hộp, lót ly, bình và đồ trang trí nội thất — mỗi sản phẩm được chế tác thủ công theo Nghệ thuật sơn mài Việt Nam, phủ nhiều lớp sơn, mài nước và đánh bóng bằng tay.",
    collectionsTitle: "Bộ sưu tập",
    collectionsIntro:
      "Mỗi năm, Red Door giới thiệu một bộ sưu tập mới — kết quả của quá trình nghiên cứu vật liệu, màu sắc và kỹ thuật bề mặt tại xưởng. Mở từng cuốn catalogue để xem trọn bộ.",
    processTitle: "Kỹ thuật sơn mài",
    processIntro:
      "Một món đồ sơn mài hoàn chỉnh đi qua hàng chục công đoạn: làm vóc, bó hom, phủ sơn, mài nước và đánh bóng. Không công đoạn nào có thể vội.",
    newsTitle: "Tin tức và câu chuyện",
    newsIntro:
      "Ghi chép từ xưởng Red Door: bộ sưu tập mới, hội chợ quốc tế và những câu chuyện phía sau từng bề mặt sơn.",
    contactTitle: "Liên hệ và yêu cầu báo giá",
    contactIntro:
      "Liên hệ với Red Door để nhận catalogue, báo giá hoặc trao đổi về đơn hàng riêng. Chúng tôi làm việc trực tiếp với các nhà bán lẻ, nhà thiết kế và thương hiệu trên toàn thế giới.",
    shopTitle: "Cửa hàng",
    shopIntro:
      "Những món sơn mài có sẵn tại xưởng, đặt mua trực tiếp. Chúng tôi xác nhận đơn và thông báo phí vận chuyển trước khi giao.",
    searchTitle: "Tìm kiếm",
    privacyTitle: "Chính sách quyền riêng tư",
    termsTitle: "Điều khoản sử dụng",
    accessibilityTitle: "Tuyên bố về khả năng tiếp cận",
  },
  about: {
    highlightVillageLabel: "Làng nghề",
    highlightVillageValue: "Nghệ thuật sơn mài Việt Nam",
    highlightComplianceLabel: "Kiểm định",
    highlightComplianceValue: "SGS — tiêu chuẩn EU",
    highlightMarketsLabel: "Thị trường",
    highlightMarketsValue: "Mỹ và châu Âu",
    mediaFeaturesEyebrow: "Dấu ấn truyền thông & truyền hình",
    mediaFeaturesTitle: "Nghệ thuật sơn mài tỏa sáng trên sóng truyền hình",
    mediaFeaturesDescription:
      "Hành trình gìn giữ di sản làng nghề sơn mài Hạ Thái và đưa nghệ thuật thủ công truyền thống Việt Nam vươn tầm thế giới qua các phóng sự tài liệu uy tín.",
    mediaVtvChannel: "VTV — Đài Truyền hình Việt Nam",
    mediaVtvTitle: "Phóng sự VTV: Gìn giữ hồn cốt sơn mài làng nghề Hạ Thái",
    mediaVtvDescription:
      "Phóng sự đặc biệt trên sóng Đài Truyền hình Việt Nam (VTV) ghi lại cận cảnh từng công đoạn chế tác công phu tại xưởng Red Door và làng nghề Hạ Thái — nơi nghệ nhân bền bỉ gắn bó với từng lớp sơn ta, mài nước và đánh bóng thủ công để lưu giữ trọn vẹn nét đẹp văn hóa Việt Nam.",
    mediaFranceChannel: "Truyền hình Pháp — France TV",
    mediaFranceTitle:
      "Đài Truyền hình Pháp: Tinh hoa sơn mài thủ công Việt Nam vươn tầm quốc tế",
    mediaFranceDescription:
      "Phóng sự tài liệu từ Đài Truyền hình Pháp tôn vinh kỹ nghệ sơn mài độc đáo của Việt Nam, quy trình kiểm định chất lượng khắt khe và sức hút vượt thời gian của các tác phẩm sơn mài Red Door đối với thị trường châu Âu.",
    pillarKicker: "Giá trị cốt lõi",
    pillarsDescription:
      "Ba điều không đổi trong từng món đồ rời xưởng Red Door.",
    pillarCraftTitle: "Thủ công trọn vẹn",
    pillarCraftDescription:
      "Mỗi sản phẩm được làm hoàn toàn bằng tay: phủ từng lớp sơn, mài nước giữa các lớp và đánh bóng đến độ sâu mong muốn. Không có hai món đồ giống hệt nhau.",
    pillarMaterialTitle: "Cảm hứng tự nhiên",
    pillarMaterialDescription:
      "Thiên nhiên có mặt trong màu sắc, chất liệu và cách bề mặt bắt sáng của từng thiết kế. Chúng tôi hướng đến những món đồ bền vững, dùng được và đẹp lên qua nhiều năm.",
    pillarStandardTitle: "Chuẩn mực quốc tế",
    pillarStandardDescription:
      "Sản phẩm Red Door được kiểm định bởi SGS theo các quy định của châu Âu về an toàn hóa chất và vật liệu, sẵn sàng cho những thị trường khắt khe nhất.",
  },
  product: {
    category: "Danh mục",
    collection: "Bộ sưu tập",
    material: "Vật liệu",
    finish: "Bề mặt hoàn thiện",
    dimensions: "Kích thước",
    care: "Bảo quản",
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
    videoUnavailable: "Video của sản phẩm này đang được thực hiện.",
    variants: "Biến thể",
    variantsUnavailable: "Sản phẩm này hiện chưa có biến thể nào khác.",
    process: "Quy trình chế tác",
    processUnavailable: "Ghi chú chế tác cho sản phẩm này đang được biên soạn.",
    noPrice: "Liên hệ để nhận báo giá",
    groupAll: "Tất cả",
    groupProcessing: "Đang sản xuất",
    groupDevelop: "Đang phát triển",
    availableOnly: "Chỉ hàng có sẵn",
    availableBadge: "Có sẵn",
    resultCount: "Đang xem {count} sản phẩm",
    searchPlaceholder: "Tìm theo tên, chất liệu…",
    applyFilters: "Áp dụng",
  },
  collection: {
    openBook: "Mở sách nghệ thuật",
    viewProducts: "Xem sản phẩm",
    download: "Tải PDF",
    downloadDisabled: "Bản PDF của bộ sưu tập này sẽ sớm được cập nhật",
  },
  processPage: {
    video1Eyebrow: "Nghệ thuật sơn mài Việt Nam",
    video1Title: "Hành trình kỳ công từ chất sơn ta đến kiệt tác sơn mài",
    video1Paragraph1:
      "Sơn mài là dòng tranh đặc sắc của mỹ thuật Việt Nam, kết tinh từ bí quyết truyền thống trao truyền qua nhiều thế hệ.",
    video1Paragraph2:
      "Hành trình kỳ công từ chất sơn ta nguyên thủy qua bàn tay tài hoa của người nghệ nhân để trở thành những bức tranh mang giá trị văn hóa độc bản.",
    playVideo1: "Xem video nghệ thuật tranh sơn mài Việt Nam",
    video2Eyebrow: "Nghệ nhân & Bí kíp sơn ta truyền thống",
    video2Title: "Nghệ nhân Vũ Huy Mến: Người giữ lửa nghề sơn mài Hạ Thái",
    video2Paragraph1:
      "Nghệ nhân Vũ Huy Mến là một trong những người giữ lửa cho nghề sơn mài Hạ Thái, dành trọn tâm huyết duy trì bí kíp làm tranh bằng sơn ta truyền thống.",
    video2Paragraph2:
      "Tranh của ông kết hợp hài hòa giữa chất sơn ta và sáng tạo cá nhân với sắc độ sâu thẳm, bền bỉ giữ gìn bản sắc trước sự cạnh tranh của sơn công nghiệp.",
    playVideo2: "Xem video nghệ nhân Vũ Huy Mến",
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
  shop: {
    heroEyebrow: "Cửa hàng Red Door",
    emptyTitle: "Cửa hàng đang được chuẩn bị",
    emptyDescription:
      "Chưa có mặt hàng nào được đưa lên bán. Vui lòng quay lại sau hoặc liên hệ để nhận báo giá.",
    inStock: "Còn hàng",
    soldOut: "Hết hàng",
    price: "Giá",
    quantity: "Số lượng",
    viewItem: "Xem mặt hàng",
    backToShop: "Về cửa hàng",
    orderTitle: "Đặt mua",
    orderDescription:
      "Điền thông tin, chúng tôi sẽ liên hệ xác nhận đơn qua điện thoại hoặc email.",
    shippingNote:
      "Giá chưa gồm phí vận chuyển. Giám đốc sẽ trao đổi phí vận chuyển với bạn trước khi giao hàng.",
    fullName: "Họ và tên",
    phone: "Số điện thoại",
    email: "Email",
    address: "Địa chỉ nhận hàng",
    note: "Ghi chú (tuỳ chọn)",
    submit: "Gửi đơn đặt mua",
    submitting: "Đang gửi…",
    successTitle: "Đã nhận đơn của bạn",
    successDescription:
      "Cảm ơn bạn. Chúng tôi đã gửi email xác nhận và sẽ liên hệ sớm để chốt phí vận chuyển.",
    orderCode: "Mã đơn",
    errorSoldOut: "Mặt hàng vừa hết hàng.",
    errorInsufficientStock: "Số lượng vượt quá tồn kho hiện có.",
    errorRateLimited: "Bạn gửi quá nhiều lần. Vui lòng thử lại sau ít phút.",
    errorInvalid: "Vui lòng kiểm tra lại các trường bắt buộc.",
    errorUnavailable:
      "Không gửi được đơn lúc này. Vui lòng thử lại hoặc liên hệ trực tiếp.",
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
    deadlineHelp:
      "Cho chúng tôi biết thời điểm bạn cần nhận hàng để xưởng sắp xếp lịch sản xuất.",
    notes: "Ghi chú",
    attachment: "Tệp đính kèm không bắt buộc",
    attachmentHelp:
      "Nhận tệp PDF, JPG, PNG hoặc WebP, tối đa 10 MB. Vui lòng không đính kèm dữ liệu cá nhân nhạy cảm.",
    mapTitle: "Bản đồ",
    mapDescription:
      "Bản đồ chỉ tải khi bạn bấm, để trang không phải gọi tới máy chủ bên thứ ba ngay từ đầu.",
    loadMap: "Tải bản đồ",
    mapUnavailable:
      "Không tải được bản đồ. Bạn có thể mở trực tiếp trong Google Maps.",
    openInMaps: "Mở trong Google Maps",
    consent:
      "Tôi đồng ý để thông tin của mình được sử dụng nhằm phản hồi yêu cầu này.",
    consentHelp:
      "Thông tin bạn cung cấp chỉ được dùng để phản hồi yêu cầu này.",
    submit: "Gửi yêu cầu",
    formNoticeTitle: "Biểu mẫu trực tuyến đang được hoàn thiện",
    formNotice:
      "Trong thời gian này, vui lòng gửi yêu cầu trực tiếp qua email hoặc điện thoại — chúng tôi sẽ phản hồi trong vòng 1–2 ngày làm việc.",
    fax: "Fax",
    officeAddress: "Văn phòng",
    factoryAddress: "Nhà máy",
    warehouseAddress: "Kho hàng",
  },
  legal: {
    lastUpdated: "Cập nhật: tháng 8, 2026",
    privacyIntro:
      "Red Door tôn trọng quyền riêng tư của khách truy cập. Chính sách này mô tả những thông tin chúng tôi thu thập khi bạn sử dụng lacquerware.vn và cách chúng tôi sử dụng chúng.",
    privacySections: [
      {
        title: "Thông tin chúng tôi thu thập",
        body: "Chúng tôi chỉ thu thập thông tin bạn chủ động cung cấp khi liên hệ hoặc yêu cầu báo giá: họ tên, công ty, địa chỉ email, số điện thoại và nội dung yêu cầu. Website không sử dụng cookie quảng cáo hay công cụ theo dõi của bên thứ ba.",
      },
      {
        title: "Cách chúng tôi sử dụng thông tin",
        body: "Thông tin liên hệ chỉ được dùng để phản hồi yêu cầu của bạn và trao đổi về đơn hàng. Chúng tôi không bán, cho thuê hay chia sẻ dữ liệu của bạn cho bên thứ ba vì mục đích tiếp thị.",
      },
      {
        title: "Liên hệ về quyền riêng tư",
        body: "Nếu bạn muốn xem, chỉnh sửa hoặc xóa thông tin đã cung cấp, vui lòng gửi email tới sales@reddoor.vn — chúng tôi sẽ xử lý trong thời gian sớm nhất.",
      },
    ],
    termsIntro:
      "Các điều khoản dưới đây áp dụng cho việc truy cập và sử dụng website lacquerware.vn của Công ty TNHH Red Door.",
    termsSections: [
      {
        title: "Sở hữu trí tuệ",
        body: "Toàn bộ hình ảnh, catalogue, văn bản và thiết kế trên website thuộc về Công ty TNHH Red Door. Vui lòng không sao chép hoặc sử dụng lại cho mục đích thương mại khi chưa có sự đồng ý bằng văn bản.",
      },
      {
        title: "Thông tin sản phẩm",
        body: "Sản phẩm sơn mài được chế tác thủ công nên mỗi món đồ có thể khác biệt nhẹ về màu sắc và vân bề mặt so với hình ảnh — đó là đặc tính tự nhiên của nghề, không phải lỗi sản phẩm. Thông số, giá và thời gian sản xuất được xác nhận trong báo giá chính thức.",
      },
      {
        title: "Báo giá và đặt hàng",
        body: "Nội dung trên website mang tính giới thiệu, không phải chào bán ràng buộc. Mọi đơn hàng được xác lập qua trao đổi trực tiếp và xác nhận đặt hàng bằng văn bản.",
      },
    ],
    accessibilityIntro:
      "Red Door mong muốn mọi khách truy cập đều có thể sử dụng website này một cách thuận tiện, bao gồm người dùng trình đọc màn hình và bàn phím.",
    accessibilitySections: [
      {
        title: "Cam kết của chúng tôi",
        body: "Website được xây dựng theo hướng dẫn WCAG 2.1 mức AA: cấu trúc tiêu đề rõ ràng, độ tương phản đủ, hỗ trợ điều hướng bằng bàn phím và văn bản thay thế cho hình ảnh.",
      },
      {
        title: "Những điểm đang hoàn thiện",
        body: "Một số nội dung như catalogue dạng sách lật có thể chưa tối ưu cho công nghệ hỗ trợ. Chúng tôi đang tiếp tục cải thiện trải nghiệm này trong các bản cập nhật tới.",
      },
      {
        title: "Phản hồi",
        body: "Nếu bạn gặp trở ngại khi sử dụng website, hãy cho chúng tôi biết qua sales@reddoor.vn để chúng tôi khắc phục.",
      },
    ],
  },
  footer: {
    description:
      "Red Door chế tác đồ sơn mài thủ công — Nghệ thuật sơn mài Việt Nam — từng lớp sơn được phủ, mài nước và đánh bóng bằng tay cho những không gian sống trên khắp thế giới.",
    navigate: "Điều hướng",
    legal: "Pháp lý",
    privacy: "Quyền riêng tư",
    terms: "Điều khoản",
    accessibility: "Khả năng tiếp cận",
    copyright:
      "© Công ty TNHH Red Door — Nghệ thuật sơn mài Việt Nam. Bảo lưu mọi quyền.",
  },
} satisfies PublicDictionary;

export default dictionary;
