import type { ScreenGuide } from "../guide-types";

/**
 * The order book and the process reference, written for the eleven-step
 * production procedure (SOP-SX-001, 09/2026). Every button, card and message
 * named here exists on the screen with exactly that label.
 */

const warehouse = ["WAREHOUSE_MANAGER"] as const;
const factoryManager = ["FACTORY_MANAGER"] as const;
const factoryAccountant = ["FACTORY_ACCOUNTANT"] as const;
const companyAccountant = ["COMPANY_ACCOUNTANT"] as const;
const priceReaders = ["FACTORY_ACCOUNTANT", "COMPANY_ACCOUNTANT"] as const;
const withoutPrice = ["WAREHOUSE_MANAGER", "FACTORY_MANAGER"] as const;
const orderWriters = ["FACTORY_MANAGER", "COMPANY_ACCOUNTANT"] as const;
const costReaders = [
  "FACTORY_MANAGER",
  "FACTORY_ACCOUNTANT",
  "COMPANY_ACCOUNTANT",
] as const;
const tradeDocumentWriters = [
  "FACTORY_ACCOUNTANT",
  "COMPANY_ACCOUNTANT",
] as const;
const notFactoryManager = [
  "WAREHOUSE_MANAGER",
  "FACTORY_ACCOUNTANT",
  "COMPANY_ACCOUNTANT",
] as const;
const notCompanyAccountant = [
  "WAREHOUSE_MANAGER",
  "FACTORY_MANAGER",
  "FACTORY_ACCOUNTANT",
] as const;

export const orderFlowScreens: readonly ScreenGuide[] = [
  {
    path: "/orders",
    title: "Sổ đơn hàng",
    summary:
      "Sổ ghi mọi đơn hàng của khách và theo dõi từng đơn đi qua mười một bước của quy trình vận hành sản xuất, từ khách đặt hàng đến theo dõi công nợ. Bấm vào mã đơn để mở trang chi tiết: ở đó ghi hàng đặt, kế hoạch sản xuất, kết quả kiểm, phiếu đóng gói, tải chứng từ và chuyển bước khi đến lượt bạn.",
    layout: [
      {
        text: "Đầu trang có tiêu đề **Sổ đơn hàng**, một đoạn giới thiệu ngắn và nút **Tạo đơn hàng** ở góc phải.",
      },
      {
        text: "Bảng danh sách đơn có các cột **Mã đơn**, **Khách hàng**, **Bước hiện tại**, **Ngày giao** và **Cập nhật**.",
        roles: withoutPrice,
      },
      {
        text: "Bảng danh sách đơn có các cột **Mã đơn**, **Khách hàng**, **Bước hiện tại**, **Ngày giao**, **Giá bán** và **Cập nhật**.",
        roles: priceReaders,
      },
      {
        text: "Cột **Bước hiện tại** ghi số bước và tên bước, ví dụ “5 · Sản xuất”. Đơn đang chạy hiện chữ vàng đậm; đơn **Đã đóng hồ sơ đơn hàng** hoặc **Đã hủy** hiện chữ xám.",
      },
      {
        text: "Trang chi tiết đơn, từ trên xuống: mã đơn và tên khách, nhãn hạn giao (ví dụ “Hạn giao 30 thg 11, 2026 · còn 40 ngày”, hoặc **Giao đúng hạn** / **Giao trễ N ngày** sau khi hàng đi); góc phải là ô **Bước hiện tại** kèm dòng “Từ … · N ngày” cho biết đơn đứng ở bước này bao lâu; rồi thanh **Tiến trình mười một bước**.",
      },
      {
        text: "Tiếp theo là thẻ **Hàng đặt** (bảng mã hàng, số lượng, đơn vị sản xuất; phần **Shipping mark, ngày giao, chỉ tiêu**), thẻ **Giá bán**, thẻ **Tiến độ xuất hàng** và thẻ **Phê duyệt của Giám đốc** khi bước đó cần duyệt.",
      },
      {
        text: "Thẻ **Sản xuất và kiểm tra chất lượng** hiện từ bước 3 trở đi: phần **Kế hoạch sản xuất (bước 3)**, phần **Công đoạn (bước 5)** với ba ô **Mộc**, **Sơn**, **Hoàn thiện**, và phần **Các lần kiểm** với ba nhãn **Kiểm mộc**, **Kiểm hoàn thiện**, **Kiểm đóng gói** cùng bảng các lần kiểm.",
      },
      {
        text: "Thẻ **Mẫu tem & shipping mark** hiện từ bước 3 trở đi: nhãn trạng thái ở góc phải (**Theo mẫu của khách**, **Mẫu công ty chờ Giám đốc duyệt**, “Mẫu công ty đã được Giám đốc duyệt ngày …” hoặc **Chưa có mẫu tem**) và hai ô **Mẫu tem, shipping mark của khách**, **Mẫu tem, shipping mark theo mẫu công ty**.",
      },
      {
        text: "Thẻ **Đóng gói (bước 7)** hiện khi đơn đang đóng gói hoặc đã có phiếu đóng gói. Thẻ **Tài liệu và chứng từ** luôn hiện, gồm bảng **Bộ chứng từ xuất khẩu** (có cột **Vị trí lập**, **Hạn**, **Trạng thái**) và phần **Hồ sơ theo bước**.",
      },
      {
        text: "Trang chi tiết đơn có thêm thẻ **Chi phí đã ghi** cho biết tổng tiền đã chi cho đơn.",
        roles: costReaders,
      },
      {
        text: "Trang chi tiết đơn có thêm thẻ **Hóa đơn (INV)** với bảng hóa đơn và khung **Lập hóa đơn cho đơn này**. Bảng của bạn không có cột **Còn thiếu**.",
        roles: factoryAccountant,
      },
      {
        text: "Trang chi tiết đơn có thêm các thẻ tiền: **Hóa đơn (INV)**, **Tiền của đơn** (kèm bảng **Phiếu thu gắn với đơn**) và **Chứng từ thanh toán**.",
        roles: companyAccountant,
      },
      {
        text: "Cuối trang luôn có thẻ **Việc liên quan**, thẻ **Chuyển bước** và **Nhật ký chuyển bước**.",
      },
    ],
    capabilities: [
      {
        text: "Xem mọi đơn hàng trong sổ: mã đơn, khách hàng, bước hiện tại, ngày giao cam kết và lần cập nhật cuối.",
      },
      {
        text: "Xem **Giá bán** của từng đơn ngay trên danh sách và trên trang chi tiết.",
        roles: priceReaders,
      },
      {
        text: "Tạo đơn mới bằng nút **Tạo đơn hàng** (bước 1): chọn khách hàng, nhập từng mã hàng với số lượng và đơn vị sản xuất trong bảng **Hàng đặt**, nhập **Shipping mark**, **Ngày giao cam kết** và **Chỉ tiêu riêng của đơn**.",
        roles: orderWriters,
      },
      {
        text: "Nhập **Giá bán (tùy chọn)** khi tạo đơn, và sửa giá trong khung **Cập nhật giá bán (trước khi Giám đốc xác nhận)** khi đơn còn ở bước 1.",
        roles: companyAccountant,
      },
      {
        text: "Sửa **Hàng đặt** (nút **Sửa hàng đặt** → **Lưu hàng đặt**) và phần **Shipping mark, ngày giao, chỉ tiêu** (nút **Lưu**) cho tới khi đơn đóng hoặc hủy.",
        roles: orderWriters,
      },
      {
        text: "Trình Giám đốc xác nhận đơn: bấm **Giám đốc xác nhận đơn hàng** trong thẻ **Chuyển bước**, rồi **Trình Giám đốc phê duyệt** trong thẻ **Phê duyệt của Giám đốc**.",
        roles: orderWriters,
      },
      {
        text: "Xác nhận mẫu và kỹ thuật (bước 2): tải **Hồ sơ kỹ thuật mẫu** trong **Hồ sơ theo bước** rồi bấm **Lập kế hoạch sản xuất** trong thẻ **Chuyển bước**.",
        roles: factoryManager,
      },
      {
        text: "Lập kế hoạch sản xuất (bước 3): điền ngày **Xong Mộc**, **Xong Sơn**, **Xong Hoàn thiện**, **Xong Đóng gói**, **Xuất hàng**, ghi **Phân công công nhân / cơ sở** rồi bấm **Lưu kế hoạch**. Có kế hoạch mới rời được bước 3.",
        roles: factoryManager,
      },
      {
        text: "Theo dõi công đoạn ở bước 5: bấm **Chuyển sang: Sơn** hoặc **Chuyển sang: Hoàn thiện** trong phần **Công đoạn (bước 5)**. Sơn chỉ bắt đầu khi **Kiểm mộc** đã đạt.",
        roles: factoryManager,
      },
      {
        text: "Ghi ba lần kiểm trong phần **Các lần kiểm**: **Ghi kiểm mộc** khi đơn ở bước 5, **Ghi kiểm hoàn thiện** ở bước 6, **Ghi kiểm đóng gói** ở bước 7. Chọn **Đạt** hoặc **Không đạt**, nhập **Số sản phẩm lỗi** và **Nhận xét**, bấm **Ghi kết quả**.",
        roles: factoryManager,
      },
      {
        text: "Chuyển đơn trong thẻ **Chuyển bước** khi đơn ở các bước: 1 · Khách hàng đặt hàng, 2 · Xác nhận mẫu & kỹ thuật, 3 · Lập kế hoạch sản xuất, 5 · Sản xuất và 6 · Kiểm tra chất lượng (QC), kể cả trả đơn về **Sản xuất** khi kiểm hoàn thiện không đạt.",
        roles: factoryManager,
      },
      {
        text: "Cấp vật tư (bước 4): bấm **Sản xuất** khi đủ vật tư, hoặc **Đặt mua vật tư** khi thiếu; ở bước **Đặt mua vật tư** bấm **Trình Giám đốc phê duyệt** rồi chờ duyệt. Tải **Phiếu xuất kho** trong **Hồ sơ theo bước**.",
        roles: warehouse,
      },
      {
        text: "Đóng gói (bước 7): điền **Ngày đóng gói xong**, **Số thùng**, **Số pallet**, **Số container (nếu đóng thẳng)** rồi bấm **Lưu phiếu đóng gói**; tải **Ảnh đóng gói** và **Phiếu đóng gói** trong **Hồ sơ theo bước**. Khi Quản lý nhà máy đã ghi **Kiểm đóng gói** đạt, bấm **Lập chứng từ xuất hàng**.",
        roles: warehouse,
      },
      {
        text: "Xuất hàng (bước 10): khi hàng đã đi, bấm **Theo dõi công nợ & báo cáo** trong thẻ **Chuyển bước**; tải **Biên bản giao hàng** nếu có.",
        roles: warehouse,
      },
      {
        text: "Lập chứng từ xuất hàng (bước 8): tải **Invoice (INV)**, **Packing List (PKL)** và **Tem nhãn** ở bảng **Bộ chứng từ xuất khẩu** (nút **Tải lên** ở cuối dòng). Có INV và PKL mới bấm được **Thủ tục xuất nhập khẩu** trong thẻ **Chuyển bước**.",
        roles: factoryAccountant,
      },
      {
        text: "Lập hóa đơn cho đơn trong khung **Lập hóa đơn cho đơn này**, xem bảng hóa đơn, bấm số hóa đơn để mở hóa đơn, và hủy hóa đơn lập sai kèm lý do.",
        roles: priceReaders,
      },
      {
        text: "Thủ tục xuất nhập khẩu (bước 9): tải **Tờ khai hải quan** ở bảng **Bộ chứng từ xuất khẩu**, rồi bấm **Xuất hàng – Giao khách** trong thẻ **Chuyển bước**. Sau khi hàng đi, tải **Bill of Lading (B/L)**, **Chứng thư hun trùng**, **Kiểm dịch thực vật (Phyto)** và **C/O (xuất xứ)** trong vòng 7 ngày.",
        roles: companyAccountant,
      },
      {
        text: "Ghi **Tiến độ xuất hàng**: **Ngày dự kiến sẵn hàng**, **Số booking**, **Ngày booking / đóng hàng**, rồi bấm **Lưu tiến độ**. Hạn của INV, PKL và tờ khai tính từ ngày booking này.",
        roles: companyAccountant,
      },
      {
        text: "Xem **Tiến độ xuất hàng** (ngày dự kiến sẵn hàng, số booking, ngày booking) khi Kế toán công ty đã nhập.",
        roles: notCompanyAccountant,
      },
      {
        text: "Theo dõi công nợ (bước 11): xem **Tiền của đơn**, ghi tiền cọc trong khung **Ghi tiền cọc cho đơn này**, tải chứng từ thanh toán, và khi khách trả đủ bấm **Đã thu đủ – Giám đốc đóng hồ sơ** trong thẻ **Chuyển bước**.",
        roles: companyAccountant,
      },
      {
        text: "Tải **Hợp đồng / PO** và **Tài liệu khác** trong **Hồ sơ theo bước**.",
        roles: orderWriters,
      },
      {
        text: "Tải mẫu tem, shipping mark trong thẻ **Mẫu tem & shipping mark**: khách có gửi mẫu thì tải vào ô **Mẫu tem, shipping mark của khách**; khách không gửi thì tải mẫu công ty vào ô **Mẫu tem, shipping mark theo mẫu công ty** để Giám đốc duyệt.",
        roles: orderWriters,
      },
      {
        text: "Xem trạng thái mẫu tem của đơn trong thẻ **Mẫu tem & shipping mark** và mở tệp mẫu để in hoặc đóng gói theo đúng mẫu.",
      },
      {
        text: "Xem tổng **Chi phí đã ghi** của đơn và bấm **Ghi / xem phiếu chi →** để sang màn **Chi phí đơn hàng**.",
        roles: costReaders,
      },
      {
        text: "Xem bảng **Bộ chứng từ xuất khẩu**: từng chứng từ **Đã có**, **Chưa có** hay **Quá hạn**, do vị trí nào lập và hạn nào; bấm tên tệp để mở xem.",
      },
      {
        text: "Đọc **Nhật ký chuyển bước**: thời điểm chuyển, bước cũ → bước mới và lý do (nếu có), lần mới nhất ở trên cùng.",
      },
    ],
    limits: [
      {
        text: "Bạn không xem được giá bán. Thẻ **Giá bán** chỉ ghi “Bạn không có quyền xem giá bán của đơn này.” Chỉ Giám đốc, Kế toán công ty và Kế toán nhà máy xem giá bán.",
        roles: withoutPrice,
      },
      {
        text: "Bạn xem được giá bán và hóa đơn, nhưng không xem tiền khách đã trả, tiền cọc, công nợ hay chứng từ thanh toán: bảng hóa đơn của bạn không có cột **Còn thiếu**, và thẻ **Tiền của đơn** không hiện. Phần đó thuộc Kế toán công ty.",
        roles: factoryAccountant,
      },
      {
        text: "Bạn không tạo được đơn hàng: trang **Tạo đơn hàng** chỉ báo “Vị trí của bạn không tạo đơn hàng.” Quản lý nhà máy hoặc Kế toán công ty ghi đơn.",
        roles: ["WAREHOUSE_MANAGER", "FACTORY_ACCOUNTANT"],
      },
      {
        text: "Trang **Tạo đơn hàng** của bạn không có ô giá bán; Kế toán công ty nhập giá sau.",
        roles: factoryManager,
      },
      {
        text: "Khi bước hiện tại thuộc vị trí khác, thẻ **Chuyển bước** chỉ hiện ô vàng “Bước hiện tại thuộc vị trí khác — bạn không giữ quyền chuyển bước này.” Hãy báo người phụ trách bước đó.",
      },
      {
        text: "Không nhảy cóc bước được, và không rời được một bước khi đầu ra của bước đó chưa có: thẻ **Chuyển bước** hiện dòng đỏ “Chưa rời được bước này:” kèm việc còn thiếu (chưa lưu kế hoạch, chưa tới công đoạn Hoàn thiện, chưa kiểm đạt, chưa có phiếu đóng gói, chưa có mẫu tem được duyệt, chưa tải INV và PKL, chưa tải tờ khai).",
      },
      {
        text: "Mẫu tem công ty chỉ Giám đốc duyệt, bằng nút **Duyệt mẫu tem này** trên trang đơn; người tải mẫu lên không tự duyệt được. Chưa có mẫu tem của khách hoặc mẫu công ty chưa được duyệt thì đơn không rời được bước 7.",
      },
      {
        text: "Tải mẫu công ty mới thì phải chờ Giám đốc duyệt lại mẫu mới; gỡ mẫu đã duyệt thì phần duyệt cũng mất.",
        roles: orderWriters,
      },
      {
        text: "Chỉ hai bước cần Giám đốc duyệt: **Giám đốc xác nhận đơn hàng** (bước 1) và **Đặt mua vật tư** (bước 4). Mọi nút trong thẻ **Chuyển bước** ở hai bước đó chỉ chạy khi thẻ **Phê duyệt của Giám đốc** báo “Đã được phê duyệt và còn hiệu lực.”",
      },
      {
        text: "Bạn không ghi kết quả kiểm và không chuyển công đoạn được; việc này thuộc Quản lý nhà máy.",
        roles: notFactoryManager,
      },
      {
        text: "Bạn không sửa được tiến độ xuất hàng và không tải được tờ khai, B/L, C/O; Kế toán công ty làm phần này.",
        roles: ["WAREHOUSE_MANAGER", "FACTORY_MANAGER"],
      },
      {
        text: "Bạn không tải được INV, PKL, tem nhãn; Kế toán nhà máy làm phần này. Bạn cũng không lập được hóa đơn.",
        roles: ["WAREHOUSE_MANAGER", "FACTORY_MANAGER"],
      },
      {
        text: "Đơn **Đã đóng hồ sơ đơn hàng** hoặc **Đã hủy** không chuyển tiếp, không sửa hàng đặt và không tải thêm tệp được nữa; thẻ **Chuyển bước** ghi “Đơn hàng đã ở trạng thái kết thúc.” Từ bước 10 trở đi không còn ô hủy đơn.",
      },
      {
        text: "Không có chỗ sửa khách hàng, mã đơn hay đơn vị thực hiện của đơn đã tạo, và không xóa được đơn. Đơn nhập sai thì hủy đơn kèm lý do rồi tạo đơn mới.",
        roles: orderWriters,
      },
      {
        text: "Danh sách không có ô tìm kiếm hay bộ lọc.",
      },
    ],
    flows: [
      {
        title: "Ghi đơn mới và trình Giám đốc (bước 1)",
        when: "Khi khách đặt hàng.",
        roles: orderWriters,
        steps: [
          "Mở **Sổ đơn hàng** và bấm **Tạo đơn hàng**.",
          "Chọn khách trong ô **Khách hàng**; chưa có khách thì nhờ Kế toán công ty thêm ở trang Khách hàng.",
          "Nhập mã vào ô **Mã đơn (bỏ trống để hệ thống tự sinh)**, hoặc để trống.",
          "Đánh dấu **Đơn vị kinh doanh thực hiện**.",
          "Trong bảng **Hàng đặt**, nhập **Mã hàng**, **Mô tả**, **Số lượng**, **ĐVT** và **Đơn vị sản xuất** (gõ để chọn cơ sở). Bấm **Thêm dòng** cho mã hàng tiếp theo.",
          "Nhập **Shipping mark** và **Ngày giao cam kết**; ghi **Chỉ tiêu riêng của đơn** nếu bác Giám đốc đã quy định.",
          "Bấm **Ghi nhận đơn hàng**.",
          "Trên trang đơn vừa mở, tải **Hợp đồng / PO** trong **Hồ sơ theo bước** nếu có.",
          "Trong thẻ **Chuyển bước**, bấm **Giám đốc xác nhận đơn hàng**.",
          "Trong thẻ **Phê duyệt của Giám đốc**, bấm **Trình Giám đốc phê duyệt**.",
        ],
        result:
          "Đơn nằm ở bước 1 chờ Giám đốc quyết định. Hệ thống không tự nhắn Giám đốc, nên hãy báo khi gấp. Giám đốc duyệt xong thì chính Giám đốc bấm **Xác nhận mẫu & kỹ thuật** để chuyển đơn sang bước 2.",
      },
      {
        title: "Xác nhận mẫu và lập kế hoạch (bước 2 → 4)",
        when: "Khi Giám đốc đã xác nhận đơn.",
        roles: factoryManager,
        steps: [
          "Mở đơn đang ở bước 2 · Xác nhận mẫu & kỹ thuật.",
          "Khi mẫu đã chốt với Thiết kế, tải bản vẽ, màu, vật liệu vào **Hồ sơ kỹ thuật mẫu** trong **Hồ sơ theo bước**.",
          "Bấm **Lập kế hoạch sản xuất** trong thẻ **Chuyển bước**.",
          "Ở bước 3, điền các ngày trong phần **Kế hoạch sản xuất (bước 3)**, ghi **Phân công công nhân / cơ sở**, bấm **Lưu kế hoạch**.",
          "Tải **Lệnh sản xuất** nếu xưởng dùng bản giấy.",
          "Bấm **Kho cấp vật tư** trong thẻ **Chuyển bước**.",
        ],
        result:
          "Đơn sang bước 4 và đến lượt Thủ kho cấp vật tư. Không cần Giám đốc duyệt kế hoạch.",
      },
      {
        title: "Cấp vật tư hoặc đặt mua (bước 4)",
        when: "Khi đơn tới bước 4 · Kho cấp vật tư.",
        roles: warehouse,
        steps: [
          "Mở đơn đang ở bước 4 · Kho cấp vật tư và đọc bảng **Hàng đặt** để biết cần gì.",
          "Đối chiếu với tồn kho ở **Nguyên vật liệu**.",
          "Nếu đủ, xuất kho như thường lệ, tải **Phiếu xuất kho** trong **Hồ sơ theo bước** rồi bấm **Sản xuất** trong thẻ **Chuyển bước**.",
          "Nếu thiếu, bấm **Đặt mua vật tư**, rồi bấm **Trình Giám đốc phê duyệt** trong thẻ **Phê duyệt của Giám đốc**.",
          "Khi hàng mua đã về và thẻ báo “Đã được phê duyệt và còn hiệu lực.”, bấm **Sản xuất**, hoặc **Kho cấp vật tư** nếu cần kiểm lại.",
        ],
        result:
          "Đơn sang bước 5 ở công đoạn **Mộc** và đến lượt Quản lý nhà máy.",
      },
      {
        title: "Sản xuất qua ba công đoạn và kiểm tra chất lượng (bước 5 → 7)",
        when: "Khi Thủ kho đã cấp vật tư.",
        roles: factoryManager,
        steps: [
          "Mở đơn đang ở bước 5 · Sản xuất; phần **Công đoạn (bước 5)** đang ở **Mộc**.",
          "Mộc xong, kiểm cốt gỗ rồi bấm **Ghi kiểm mộc** với **Đạt** (hoặc **Không đạt** kèm **Số sản phẩm lỗi**) và bấm **Ghi kết quả**.",
          "Khi kiểm mộc đạt, bấm **Chuyển sang: Sơn**; sơn xong bấm **Chuyển sang: Hoàn thiện**.",
          "Hoàn thiện xong, bấm **Kiểm tra chất lượng (QC)** trong thẻ **Chuyển bước**.",
          "Ở bước 6, kiểm thành phẩm rồi bấm **Ghi kiểm hoàn thiện**: chọn **Đạt**, nhập **Số sản phẩm lỗi** nếu có, bấm **Ghi kết quả**. Tải **Checklist QC** nếu có bản giấy.",
          "Nhãn **Kiểm hoàn thiện: Đạt** hiện lên thì bấm **Đóng gói & nhập thành phẩm** trong thẻ **Chuyển bước**.",
          "Ở bước 7, sau khi Thủ kho lưu phiếu đóng gói, kiểm hàng đã đóng rồi bấm **Ghi kiểm đóng gói** với **Đạt**.",
        ],
        result:
          "Nhãn **Tỷ lệ lỗi** trên thẻ tính từ số lỗi bạn ghi so với số lượng đặt. Kiểm đóng gói đạt thì Thủ kho chuyển đơn sang bước 8.",
      },
      {
        title: "Trả đơn về sản xuất khi kiểm hoàn thiện không đạt",
        when: "Khi kiểm ở bước 6 thấy hàng chưa đạt.",
        roles: factoryManager,
        steps: [
          "Bấm **Ghi kiểm hoàn thiện** với **Không đạt**, nhập **Số sản phẩm lỗi** và **Nhận xét**, bấm **Ghi kết quả**.",
          "Trong thẻ **Chuyển bước**, ô có dòng **Chuyển sang: 5 · Sản xuất**, nhập **Lý do (bắt buộc)** rồi bấm **Sản xuất**.",
          "Sửa hàng xong, bấm **Chuyển sang** công đoạn phù hợp nếu cần, rồi bấm **Kiểm tra chất lượng (QC)** để kiểm lại.",
        ],
        result:
          "Lý do được lưu vào **Nhật ký chuyển bước**. Mỗi lần vào lại bước 6 phải ghi **Kiểm hoàn thiện** đạt lần nữa.",
      },
      {
        title: "Đóng gói và xuất hàng (bước 7 và 10)",
        when: "Khi Quản lý nhà máy đã chuyển đơn sang bước 7 · Đóng gói & nhập thành phẩm.",
        roles: warehouse,
        steps: [
          "Mở đơn đang ở bước 7.",
          "Đóng gói xong, điền **Ngày đóng gói xong**, **Số thùng**, **Số pallet** (và **Số container (nếu đóng thẳng)**) trong thẻ **Đóng gói (bước 7)**, bấm **Lưu phiếu đóng gói**.",
          "Chụp ảnh toàn bộ hàng đã đóng và tải vào **Ảnh đóng gói** trong **Hồ sơ theo bước**; tải **Phiếu đóng gói** nếu có bản giấy.",
          "Kiểm tra thẻ **Mẫu tem & shipping mark** báo **Theo mẫu của khách** hoặc mẫu công ty đã được Giám đốc duyệt; chưa có thì báo Quản lý nhà máy.",
          "Báo Quản lý nhà máy ghi **Kiểm đóng gói**; khi nhãn báo **Đạt**, bấm **Lập chứng từ xuất hàng** trong thẻ **Chuyển bước**.",
          "Khi đơn tới bước 10 · Xuất hàng – Giao khách, bàn giao hàng cho vận chuyển, tải **Biên bản giao hàng** nếu có, rồi bấm **Theo dõi công nợ & báo cáo**.",
        ],
        result:
          "Nhãn hạn giao trên đầu trang đổi thành **Giao đúng hạn** hoặc **Giao trễ N ngày**. Đơn sang bước 11 và đến lượt Kế toán công ty.",
      },
      {
        title: "Tải mẫu tem, shipping mark (trước khi rời bước 7)",
        when: "Khi khách gửi mẫu tem, shipping mark, hoặc khi đơn đã lập kế hoạch sản xuất mà khách không gửi mẫu.",
        roles: orderWriters,
        steps: [
          "Mở đơn từ **Sổ đơn hàng** và kéo tới thẻ **Mẫu tem & shipping mark**.",
          "Khách có gửi mẫu: bấm **Tải lên** ở ô **Mẫu tem, shipping mark của khách** và chọn file của khách.",
          "Khách không gửi mẫu: làm mẫu theo mẫu công ty, bấm **Tải lên** ở ô **Mẫu tem, shipping mark theo mẫu công ty**.",
          "Báo Giám đốc mở đơn để duyệt; nhãn trạng thái đổi từ **Mẫu công ty chờ Giám đốc duyệt** sang “Mẫu công ty đã được Giám đốc duyệt ngày …”.",
          "Chỉ in tem khi nhãn báo **Theo mẫu của khách** hoặc mẫu công ty đã được duyệt.",
        ],
        result:
          "Đơn đủ điều kiện mẫu tem để rời bước 7. Sửa mẫu công ty thì tải bản mới lên và chờ Giám đốc duyệt lại.",
      },
      {
        title: "Lập INV, PKL và tem nhãn (bước 8)",
        when: "Ngay khi có số booking, chậm nhất 3 tuần trước ngày đóng hàng; và phải xong trước khi đơn rời bước 8.",
        roles: factoryAccountant,
        steps: [
          "Mở đơn từ **Sổ đơn hàng**; đọc **Hàng đặt**, **Shipping mark** và **Giá bán**.",
          "Lập hóa đơn trong khung **Lập hóa đơn cho đơn này** của thẻ **Hóa đơn (INV)** nếu chưa có.",
          "Trong bảng **Bộ chứng từ xuất khẩu**, bấm **Tải lên** ở dòng **Invoice (INV)** và chọn file INV; làm tương tự cho **Packing List (PKL)** và **Tem nhãn**.",
          "Kiểm tra cột **Trạng thái** của ba dòng đã thành **Đã có**.",
          "Khi đơn ở bước 8, bấm **Thủ tục xuất nhập khẩu** trong thẻ **Chuyển bước**.",
        ],
        result:
          "Đơn sang bước 9 và đến lượt Kế toán công ty làm tờ khai. Cột **Hạn** ghi ngày phải có từng chứng từ; quá ngày mà chưa tải thì dòng báo **Quá hạn**.",
      },
      {
        title: "Tờ khai hải quan và bộ chứng từ sau khi hàng đi (bước 9 → 11)",
        when: "Khi đơn tới bước 9 · Thủ tục xuất nhập khẩu, và trong 7 ngày sau khi hàng đi.",
        roles: companyAccountant,
        steps: [
          "Mở đơn và cập nhật **Tiến độ xuất hàng** (**Số booking**, **Ngày booking / đóng hàng**) nếu chưa có.",
          "Trong bảng **Bộ chứng từ xuất khẩu**, bấm **Tải lên** ở dòng **Tờ khai hải quan**.",
          "Bấm **Xuất hàng – Giao khách** trong thẻ **Chuyển bước**.",
          "Sau khi Thủ kho chuyển đơn sang bước 11, tải **Bill of Lading (B/L)**, **Chứng thư hun trùng**, **Kiểm dịch thực vật (Phyto)** và **C/O (xuất xứ)** vào các dòng tương ứng trước hạn ghi ở cột **Hạn**.",
          "Theo dõi tiền về trong thẻ **Tiền của đơn**; khách trả đủ thì bấm **Đã thu đủ – Giám đốc đóng hồ sơ**.",
        ],
        result:
          "Đơn chờ Giám đốc đóng hồ sơ. Giám đốc đọc lợi nhuận của đơn trên trang đơn; các vị trí khác không thấy phần này.",
      },
      {
        title: "Lập hóa đơn (INV) cho đơn",
        when: "Khi xuất hóa đơn cho khách.",
        roles: priceReaders,
        steps: [
          "Mở đơn chưa đóng hay hủy.",
          "Kéo xuống thẻ **Hóa đơn (INV)**, tới khung **Lập hóa đơn cho đơn này**.",
          "Nhập **Số hóa đơn (INV)**, chọn **Ngày lập** và **Hạn thanh toán**.",
          "Nhập **Giá trị hóa đơn** và chọn **Tiền tệ**; hóa đơn USD nhập **Tỷ giá VND/USD** hoặc để trống để lấy tỷ giá trong bảng.",
          "Bấm **Lập hóa đơn**.",
        ],
        result:
          "Trang của hóa đơn vừa lập mở ra để bạn tải file INV lên. Hóa đơn hiện trong bảng **Hóa đơn (INV)** của đơn.",
      },
      {
        title: "Ghi tiền cọc, hoàn tiền và chứng từ thanh toán",
        when: "Khi khách chuyển tiền cọc, khi đơn đã hủy mà khách còn tiền trả dư, hoặc khi có ủy nhiệm chi, giấy báo có, L/C cần lưu.",
        roles: companyAccountant,
        steps: [
          "Mở đơn và kéo xuống thẻ **Tiền của đơn**.",
          "Ghi cọc trong khung **Ghi tiền cọc cho đơn này**: **Số tiền**, **Tiền tệ**, **Hình thức**, **Ngày**, bấm **Ghi phiếu**.",
          "Hủy phiếu ghi sai bằng ô **Lý do hủy…** và nút **Hủy phiếu** trong bảng **Phiếu thu gắn với đơn**.",
          "Với đơn **Đã hủy** mà khách còn tiền dư, ghi trong khung **Hoàn tiền cho khách**.",
          "Tải chứng từ bằng nút **Tải chứng từ lên** trong thẻ **Chứng từ thanh toán**; bấm **Gỡ** để bỏ tệp tải nhầm.",
        ],
        result:
          "Phiếu và chứng từ nằm cùng đơn; thẻ **Tiền của đơn** tính lại ngay.",
      },
      {
        title: "Hủy đơn hàng",
        when: "Khi đơn phải dừng hẳn và đơn đang ở bước bạn được chuyển (từ bước 1 đến bước 9).",
        steps: [
          "Mở đơn từ **Sổ đơn hàng**.",
          "Nếu đơn đang ở bước **Giám đốc xác nhận đơn hàng** hoặc **Đặt mua vật tư**, kiểm tra thẻ **Phê duyệt của Giám đốc** báo “Đã được phê duyệt và còn hiệu lực.”; chưa có thì trình duyệt trước.",
          "Trong thẻ **Chuyển bước**, tìm ô có dòng **Chuyển sang: Đã hủy**.",
          "Nhập lý do vào **Lý do (bắt buộc)**.",
          "Bấm nút viền đỏ **Đã hủy**.",
        ],
        result:
          "Đơn dừng hẳn và không chuyển tiếp được nữa; lý do được lưu vào **Nhật ký chuyển bước**. Không có nút khôi phục đơn đã hủy.",
      },
    ],
    terms: [
      {
        term: "**Mã đơn**",
        meaning:
          "Mã riêng của đơn. Mã tự sinh có dạng RD-năm tháng ngày-4 ký tự, ví dụ RD-20260827-XXXX.",
      },
      {
        term: "**Bước hiện tại** và dòng “Từ … · N ngày”",
        meaning:
          "Bước đơn đang đứng, số ở đầu là số bước trên quy trình; dòng nhỏ bên dưới cho biết đơn vào bước này lúc nào và đã ở đó bao nhiêu ngày.",
      },
      {
        term: "**Tiến trình mười một bước**",
        meaning:
          "Dải ô các bước của quy trình: ô đỏ đậm là bước hiện tại, ô vàng nhạt là bước đã qua, ô mờ là bước chưa tới. Bước 1, 4 và 11 mỗi bước có hai trạng thái nhưng chỉ hiện một ô.",
      },
      {
        term: "Nhãn hạn giao: “Hạn giao … · còn N ngày”, **Giao đúng hạn**, **Giao trễ N ngày**",
        meaning:
          "So sánh **Ngày giao cam kết** với ngày hàng đi (lúc đơn rời bước 10). Chưa đi thì báo còn hoặc quá bao nhiêu ngày.",
      },
      {
        term: "**Shipping mark**",
        meaning: "Ký mã hiệu in trên thùng hàng theo yêu cầu của khách.",
      },
      {
        term: "**Đơn vị sản xuất**",
        meaning:
          "Cơ sở hoặc xưởng làm mã hàng đó. Gõ để chọn từ danh sách cơ sở của kho, hoặc nhập tên mới.",
      },
      {
        term: "**Chỉ tiêu riêng của đơn**",
        meaning:
          "Yêu cầu Giám đốc đặt cho riêng đơn này (tỷ lệ lỗi, hao hụt…). Ghi bằng chữ; hệ thống hiện lại trên trang đơn.",
      },
      {
        term: "**Công đoạn**: **Mộc**, **Sơn**, **Hoàn thiện**",
        meaning:
          "Ba công đoạn của bước 5. Ô đỏ là công đoạn đang làm. Đóng gói là bước 7 riêng.",
      },
      {
        term: "**Kiểm mộc**, **Kiểm hoàn thiện**, **Kiểm đóng gói**",
        meaning:
          "Ba lần kiểm do Quản lý nhà máy ghi: kiểm cốt gỗ trước khi sơn (bước 5), kiểm thành phẩm (bước 6), kiểm hàng đã đóng (bước 7). Nhãn hiện **Đạt**, **Không đạt** hoặc **chưa kiểm** theo lần ghi mới nhất.",
      },
      {
        term: "**Tỷ lệ lỗi**",
        meaning:
          "Số sản phẩm lỗi ghi ở lần kiểm mới nhất của mỗi điểm kiểm, chia cho tổng số lượng đặt.",
      },
      {
        term: "**Phiếu đóng gói**",
        meaning:
          "Số thùng, số pallet, số container và ngày đóng xong do Thủ kho ghi. Có phiếu và kiểm đóng gói đạt mới rời được bước 7.",
      },
      {
        term: "**Bộ chứng từ xuất khẩu**",
        meaning:
          "INV, PKL, tem nhãn (Kế toán nhà máy, hạn 3 tuần trước ngày booking); tờ khai hải quan (Kế toán công ty, trước ngày booking); B/L, hun trùng, Phyto, C/O (Kế toán công ty, 7 ngày sau khi hàng đi). Cột **Trạng thái**: **Đã có**, **Chưa có**, **Quá hạn**.",
      },
      {
        term: "**Mẫu tem & shipping mark**: **Theo mẫu của khách**, **Mẫu công ty chờ Giám đốc duyệt**, “Mẫu công ty đã được Giám đốc duyệt ngày …”",
        meaning:
          "Tem sản phẩm và shipping mark in theo mẫu khách gửi. Khách không gửi thì dùng mẫu công ty, và mẫu đó phải được Giám đốc duyệt trước khi in. Nhãn nhỏ **đã duyệt** đánh dấu đúng tệp Giám đốc đã duyệt.",
      },
      {
        term: "INV, PKL, B/L, C/O, Phyto",
        meaning:
          "Invoice (hóa đơn thương mại), Packing List (bảng kê đóng gói), Bill of Lading (vận đơn), Certificate of Origin (chứng nhận xuất xứ), chứng nhận kiểm dịch thực vật.",
      },
      {
        term: "**Hồ sơ theo bước**",
        meaning:
          "Các tệp từng bước sinh ra: hợp đồng, hồ sơ kỹ thuật, lệnh sản xuất, phiếu xuất kho, checklist QC, phiếu và ảnh đóng gói, biên bản giao hàng, tài liệu khác. Mỗi loại chỉ vị trí phụ trách bước đó tải và gỡ được.",
      },
      {
        term: "“Chưa rời được bước này: …”",
        meaning:
          "Dòng đỏ trong thẻ **Chuyển bước** liệt kê đầu ra còn thiếu của bước hiện tại. Làm xong việc đó thì nút chuyển mới chạy.",
      },
      {
        term: "“Đã được phê duyệt và còn hiệu lực.”",
        meaning:
          "Giám đốc đã duyệt và đơn chưa thay đổi gì sau đó. Người phụ trách bước được chuyển đơn đi tiếp.",
      },
      {
        term: "“Đã có phê duyệt nhưng đơn hàng đã thay đổi sau đó — phải trình duyệt lại.”",
        meaning:
          "Sau khi duyệt, đơn đã bị sửa (giá, hàng đặt, tệp…), nên phê duyệt cũ không còn dùng được. Hãy trình lại.",
      },
      {
        term: "**Giá bán**",
        meaning:
          "Giá bán của đơn cho khách. Chỉ Giám đốc, Kế toán công ty và Kế toán nhà máy xem được; người khác thấy dòng báo không có quyền xem.",
      },
      {
        term: "**Còn thiếu** / **Khách trả dư**",
        meaning:
          "Dòng cuối của thẻ **Tiền của đơn**. Chữ đỏ **Còn thiếu** là khách còn nợ; chữ xanh **Khách trả dư** là khách đã trả đủ hoặc trả thừa.",
        roles: companyAccountant,
      },
      {
        term: "**Chi phí đã ghi**",
        meaning:
          "Tổng các phiếu chi còn hiệu lực gắn với đơn, cộng riêng theo từng loại tiền.",
        roles: costReaders,
      },
    ],
    tips: [
      {
        text: "Chỉ bấm nút chuyển bước khi việc ngoài thực tế đã xong. Không có nút lùi bước (trừ trả về sản xuất ở bước 6); bấm nhầm thì báo Giám đốc ngay.",
      },
      {
        text: "Mọi thay đổi trên đơn (lưu giá bán, hàng đặt, tiến độ xuất hàng, tải hoặc gỡ tệp, ghi kiểm) làm phê duyệt đang có hoặc đang chờ mất hiệu lực. Ở bước cần duyệt, làm xong các thay đổi rồi mới trình Giám đốc.",
      },
      {
        text: "Tải INV và PKL ngay khi có số booking, không đợi tới bước 8: hạn của hai chứng từ này là 3 tuần trước ngày booking, và cột **Hạn** sẽ báo **Quá hạn** nếu chậm.",
        roles: factoryAccountant,
      },
      {
        text: "Nhập **Ngày booking / đóng hàng** sớm, vì hạn của mọi chứng từ xuất khẩu tính từ ngày đó; chưa có ngày booking thì cột **Hạn** ghi “Chưa có ngày booking”.",
        roles: companyAccountant,
      },
      {
        text: "Ghi **Số sản phẩm lỗi** ở mỗi lần kiểm, kể cả khi đạt, để **Tỷ lệ lỗi** của đơn đúng với thực tế.",
        roles: factoryManager,
      },
      {
        text: "Dòng vàng dưới tiêu đề là thông báo đã làm xong, ví dụ “Đã chuyển bước.”, “Đã lưu kế hoạch sản xuất.”, “Đã ghi kết quả kiểm.”, “Đã lưu phiếu đóng gói.”, “Đã lưu hàng đặt.”",
      },
      {
        text: "Dòng đỏ bắt đầu bằng “Thao tác không thành công:” nghĩa là chưa có gì được lưu. “Đơn hàng đã thay đổi trong lúc bạn thao tác…” là có người vừa sửa đơn: đọc lại trang rồi làm lại.",
      },
      {
        text: "“Kiểm mộc phải đạt thì mới chuyển sang Sơn.”: ghi **Kiểm mộc** đạt trước. “Đơn phải ở công đoạn Hoàn thiện mới sang kiểm tra chất lượng.”: bấm **Chuyển sang: Hoàn thiện** trước.",
        roles: factoryManager,
      },
      {
        text: "“Phải tải INV và PKL lên trước khi rời bước 8.” và “Phải tải tờ khai hải quan lên trước khi rời bước 9.”: tải tệp vào đúng dòng trong bảng **Bộ chứng từ xuất khẩu** rồi bấm lại.",
        roles: tradeDocumentWriters,
      },
      {
        text: "“Cần phiếu đóng gói của Thủ kho và kiểm đóng gói đạt trước khi rời bước 7.”: lưu phiếu đóng gói và nhờ Quản lý nhà máy ghi kiểm đóng gói.",
        roles: warehouse,
      },
      {
        text: "“Cần mẫu tem, shipping mark của khách, hoặc mẫu công ty đã được Giám đốc duyệt, trước khi rời bước 7.”: xem thẻ **Mẫu tem & shipping mark**; chưa có mẫu thì báo người ghi đơn tải lên, mẫu công ty còn chờ thì báo Giám đốc duyệt.",
        roles: warehouse,
      },
      {
        text: "Lỗi khi tạo đơn hiện ở dòng đỏ “Không tạo được đơn:”: “Dữ liệu nhập chưa hợp lệ.” thường do số lượng có chữ hoặc dấu phẩy, mã hàng để trống ở dòng đã nhập số lượng, hoặc chưa đánh dấu đơn vị thực hiện.",
        roles: orderWriters,
      },
      {
        text: "Danh sách không có ô tìm kiếm: bấm Ctrl+F rồi gõ mã đơn hoặc tên khách để tìm nhanh.",
      },
    ],
  },
  {
    path: "/operations",
    title: "Quy trình đơn hàng",
    summary:
      "Trang tham khảo quy trình mười một bước của một đơn hàng: bước nào do vị trí nào phụ trách, bước nào bắt buộc Giám đốc duyệt và bước nào cần đầu ra gì mới rời được. Trang chỉ để xem; mọi việc trên đơn thật làm ở **Sổ đơn hàng**.",
    layout: [
      {
        text: "Đầu trang có dòng **Quy trình vận hành**, tiêu đề **Mười một bước của một đơn hàng** và đoạn giới thiệu.",
      },
      {
        text: "Bảng chính có các cột **STT**, **Bước**, **Vị trí phụ trách**, **Quyền để chuyển bước** và **Giám đốc duyệt**, mỗi dòng một trạng thái theo đúng thứ tự. Số 01, 04 và 11 có hai dòng vì mỗi bước đó gồm hai trạng thái.",
      },
      {
        text: "Thẻ **Hai nhánh rẽ** giải thích hai chỗ quy trình rẽ nhánh: thiếu vật tư và kiểm tra chất lượng không đạt.",
      },
      {
        text: "Thẻ **Ràng buộc bắt buộc** liệt kê các luật luôn áp dụng khi chuyển bước đơn.",
      },
    ],
    capabilities: [
      {
        text: "Tra xem mỗi bước do vị trí nào phụ trách trước khi chuyển bước trên đơn.",
      },
      {
        text: "Biết trước bước nào cần Giám đốc duyệt (cột **Giám đốc duyệt** ghi **Bắt buộc**): **Giám đốc xác nhận đơn hàng** ở bước 1 và **Đặt mua vật tư** ở bước 4.",
      },
      {
        text: "Đọc các ràng buộc: kế hoạch phải lưu trước khi rời bước 3; kiểm mộc đạt mới sang Sơn; tới Hoàn thiện mới sang kiểm tra chất lượng; kiểm hoàn thiện đạt mới đóng gói; phiếu đóng gói và kiểm đóng gói đạt mới rời bước 7; có mẫu tem của khách hoặc mẫu công ty đã được Giám đốc duyệt mới rời bước 7; INV và PKL mới rời bước 8; tờ khai mới rời bước 9.",
      },
      {
        text: "Nhìn nhanh các bước ghi tên bạn: 1 · Khách hàng đặt hàng, 2 · Xác nhận mẫu & kỹ thuật, 3 · Lập kế hoạch sản xuất, 5 · Sản xuất và 6 · Kiểm tra chất lượng (QC).",
        roles: factoryManager,
      },
      {
        text: "Nhìn nhanh các bước ghi tên bạn: 9 · Thủ tục xuất nhập khẩu và 11 · Theo dõi công nợ & báo cáo.",
        roles: companyAccountant,
      },
    ],
    limits: [
      {
        text: "Trang không có nút nào: không tạo, sửa hay chuyển bước đơn ở đây. Làm các việc đó trong **Sổ đơn hàng**.",
      },
      {
        text: "Trang không cho biết một đơn cụ thể đang ở bước nào; mở đơn trong **Sổ đơn hàng** để xem.",
      },
      {
        text: "Không có chỗ đổi người phụ trách hay danh sách bước cần duyệt; quy trình được cài sẵn theo văn bản của Giám đốc và giống nhau cho mọi đơn.",
      },
    ],
    flows: [
      {
        title: "Tra cứu trước khi chuyển bước một đơn",
        when: "Khi không chắc bước tiếp theo của đơn là của ai, có cần Giám đốc duyệt không, hay cần đầu ra gì.",
        steps: [
          "Mở **Quy trình đơn hàng** trong menu.",
          "Tìm trong cột **Bước** tên bước đang hiện ở ô **Bước hiện tại** của đơn.",
          "Đọc cột **Vị trí phụ trách** để biết ai chuyển đơn ra khỏi bước đó.",
          "Đọc cột **Giám đốc duyệt**: nếu ghi **Bắt buộc**, phải trình Giám đốc duyệt trước.",
          "Đọc thẻ **Ràng buộc bắt buộc** để biết bước đó cần đầu ra gì.",
          "Quay lại **Sổ đơn hàng**, mở đơn và làm tiếp.",
        ],
        result:
          "Bạn biết cần báo ai, có phải trình duyệt không và phải ghi gì trước khi thao tác trên đơn.",
      },
    ],
    terms: [
      {
        term: "**STT**",
        meaning:
          "Số thứ tự bước trên quy trình, ghi hai chữ số (01, 02…). Một số bước có hai dòng vì gồm hai trạng thái, ví dụ 04 gồm **Kho cấp vật tư** và **Đặt mua vật tư**.",
      },
      {
        term: "**Bước**",
        meaning: "Tên bước, giống hệt tên hiện ở ô **Bước hiện tại** trên đơn.",
      },
      {
        term: "**Vị trí phụ trách**",
        meaning:
          "Vị trí chịu trách nhiệm chuyển đơn ra khỏi bước: Quản lý nhà máy, Giám đốc, Thủ kho / Quản lý kho, Kế toán nhà máy hoặc Kế toán công ty.",
      },
      {
        term: "**Quyền để chuyển bước**",
        meaning:
          "Dòng mã tiếng Anh dùng để phân quyền trong hệ thống. Bạn không cần dùng đến; hãy đọc cột **Vị trí phụ trách**.",
      },
      {
        term: "**Giám đốc duyệt**: **Bắt buộc** / **Không**",
        meaning:
          "**Bắt buộc**: phải có phê duyệt còn hiệu lực của Giám đốc mới rời được bước. **Không**: không cần duyệt.",
      },
    ],
    tips: [
      {
        text: "Trên đơn thật, nút chuyển ở một số bước có thể hiện với cả bạn dù người phụ trách là vị trí khác. Hãy thống nhất trước khi bấm.",
      },
      {
        text: "Hủy đơn và trả đơn về sản xuất luôn phải ghi lý do, và lý do được lưu vào nhật ký của đơn. Hãy viết lý do rõ ràng.",
      },
      {
        text: "Trang này không có thông báo hay lỗi nào vì không có thao tác.",
      },
    ],
  },
];
