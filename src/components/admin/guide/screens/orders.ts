import type { ScreenGuide } from "../guide-types";

/**
 * The customer and supplier directories. The order book and the process
 * reference live in `order-flow.ts`.
 */
export const orderScreens: readonly ScreenGuide[] = [
  {
    path: "/customers",
    title: "Khách hàng",
    summary:
      "Danh sách khách hàng của công ty. Mỗi đơn hàng, hóa đơn và phiếu thu đều gắn với một khách trong danh sách, nên công nợ và tiền trả trước cộng được theo từng khách. Bạn tự thêm khách mới, sửa thông tin và xem công nợ, đơn hàng, tiền đã trả của từng khách.",
    layout: [
      {
        text: "Đầu trang có tiêu đề **Danh sách khách hàng** và đoạn giới thiệu.",
      },
      {
        text: "Khung **Thêm khách hàng** là mẫu nhập khách mới gồm **Tên khách hàng**, **Mã khách hàng**, **Mã số thuế**, **Quốc gia**, **Email**, **Điện thoại**, **Địa chỉ**, **Loại tiền thường dùng** và **Ghi chú**.",
      },
      {
        text: "Dòng chữ **Xem khách đã lưu trữ** mở danh sách **Khách hàng đã lưu trữ**; ở đó dòng **Xem khách đang hoạt động** đưa bạn quay lại.",
      },
      {
        text: "Bảng khách có các cột **Mã**, **Tên**, **Quốc gia**, **Tiền** và **Liên hệ** (email · điện thoại). Bấm tên khách để mở trang chi tiết.",
      },
      {
        text: "Trang chi tiết khách: tên khách, mã khách và MST ở đầu trang (kèm nhãn **Đã lưu trữ** nếu khách đã lưu trữ), rồi lần lượt thẻ **Công nợ**, khung **Hoàn tiền cho khách** (chỉ khi khách trả dư), thẻ **Đơn hàng**, bảng **Tiền khách đã trả** và thẻ **Thông tin** để sửa hồ sơ.",
      },
      {
        text: "Dòng **← Danh sách khách hàng** ở đầu trang chi tiết đưa bạn về danh sách.",
      },
    ],
    capabilities: [
      {
        text: "Thêm khách mới ngay trên danh sách.",
      },
      {
        text: "Xem danh sách khách đang hoạt động và danh sách khách đã lưu trữ.",
      },
      {
        text: "Xem email và điện thoại của khách ở cột **Liên hệ**.",
      },
      {
        text: "Mở hồ sơ khách để sửa mọi thông tin trong thẻ **Thông tin** rồi bấm **Lưu thay đổi**.",
      },
      {
        text: "Xem **Công nợ** của khách theo từng loại tiền: **Đã xuất hóa đơn**, **Đã thu**, **Đã hoàn**, **Còn phải thu** (kèm số hóa đơn quá hạn), **Trả trước / dư** và **Cân đối**.",
      },
      {
        text: "Xem mọi đơn hàng của khách trong thẻ **Đơn hàng** với **Mã đơn**, **Bước hiện tại** và **Giá bán**; bấm mã đơn để mở đơn.",
      },
      {
        text: "Xem mọi phiếu tiền của khách trong bảng **Tiền khách đã trả**: phiếu thu (loại **Thu**) và phiếu hoàn tiền (loại **Chi**).",
      },
      {
        text: "Bấm ô ở cột **Phân bổ** để mở phiếu thu và chia tiền vào hóa đơn.",
      },
      {
        text: "Hủy phiếu thu ghi sai bằng nút **Hủy phiếu** kèm lý do.",
      },
      {
        text: "Ghi phiếu hoàn tiền cho khách đang trả dư trong khung **Hoàn tiền cho khách**.",
      },
    ],
    limits: [
      {
        text: "Bạn không lưu trữ hay khôi phục được khách hàng; nút **Lưu trữ khách hàng** và **Khôi phục** chỉ hiện với Giám đốc. Cần ngừng dùng hoặc dùng lại một khách thì nhờ Giám đốc.",
      },
      {
        text: "Không xóa được khách hàng.",
      },
      {
        text: "Danh sách không có ô tìm kiếm hay bộ lọc, ngoài việc chuyển giữa khách đang hoạt động và khách đã lưu trữ.",
      },
      {
        text: "Không tạo đơn hay lập hóa đơn trên trang khách; làm ở **Sổ đơn hàng** và **Hóa đơn (INV)**.",
      },
      {
        text: "Không hủy được phiếu hoàn tiền trên trang này; nút **Hủy phiếu** chỉ có ở phiếu thu.",
      },
      {
        text: "Đổi tên khách không đổi tên trên các đơn cũ: mỗi đơn giữ tên khách lúc tạo đơn.",
      },
    ],
    flows: [
      {
        title: "Thêm khách hàng mới",
        when: "Khi có khách mới, trước khi tạo đơn đầu tiên cho khách.",
        steps: [
          "Mở **Khách hàng** trong menu.",
          "Nhập **Tên khách hàng** (bắt buộc).",
          "Nhập **Mã khách hàng** theo sổ kế toán, hoặc để trống nếu chưa có.",
          "Nhập **Mã số thuế**, **Quốc gia**, **Email**, **Điện thoại** và **Địa chỉ** nếu có.",
          "Chọn **Loại tiền thường dùng**.",
          "Ghi **Ghi chú** nếu cần.",
          "Bấm **Thêm khách hàng**.",
        ],
        result:
          "Trang chi tiết của khách mới mở ra với dòng xanh “Đã thêm khách hàng.” Khách có ngay trong ô chọn khách khi tạo đơn hàng.",
      },
      {
        title: "Sửa thông tin khách",
        steps: [
          "Bấm tên khách trong danh sách.",
          "Kéo xuống thẻ **Thông tin**.",
          "Sửa các ô cần đổi.",
          "Bấm **Lưu thay đổi**.",
        ],
        result: "Dòng xanh “Đã lưu.” hiện ra.",
      },
      {
        title: "Xem công nợ và tiền của một khách",
        when: "Khi đối chiếu công nợ hoặc trả lời khách về số tiền còn nợ.",
        steps: [
          "Bấm tên khách trong danh sách.",
          "Đọc thẻ **Công nợ**; mỗi ô là một loại tiền.",
          "Xem **Còn phải thu** và số hóa đơn quá hạn ghi trong ngoặc.",
          "Xem **Trả trước / dư** để biết tiền khách trả trước chưa dùng hết.",
          "Kéo xuống bảng **Tiền khách đã trả** để xem từng phiếu.",
          "Bấm ô ở cột **Phân bổ** của phiếu còn **Chưa phân bổ** để chia tiền vào hóa đơn.",
        ],
        result:
          "Bạn có số nợ, số trả dư và danh sách phiếu của khách trên một trang.",
      },
      {
        title: "Hoàn tiền cho khách đang trả dư",
        when: "Khi bạn thực sự chuyển trả tiền cho khách.",
        steps: [
          "Mở trang khách; khung **Hoàn tiền cho khách** chỉ hiện khi **Trả trước / dư** lớn hơn 0.",
          "Kiểm tra **Số tiền** và **Tiền tệ** đã điền sẵn bằng số khách đang trả dư; sửa nếu chỉ hoàn một phần.",
          "Chọn **Hình thức** và **Ngày**.",
          "Ghi **Ghi chú**, ví dụ số giao dịch ngân hàng.",
          "Bấm **Hoàn tiền cho khách**.",
        ],
        result:
          "Dòng xanh “Đã ghi phiếu hoàn tiền.” hiện ra. Phiếu nằm trong bảng **Tiền khách đã trả** với loại **Chi**, và thẻ **Công nợ** hiện thêm dòng **Đã hoàn**.",
      },
      {
        title: "Hủy một phiếu thu ghi sai",
        steps: [
          "Mở trang khách và tìm phiếu trong bảng **Tiền khách đã trả**.",
          "Nhập lý do vào ô **Lý do hủy…** ở cột **Thao tác**.",
          "Bấm **Hủy phiếu**.",
        ],
        result:
          "Dòng xanh “Đã hủy phiếu.” hiện ra; phiếu mờ đi, ghi **Đã hủy** kèm lý do và không còn tính vào công nợ.",
      },
      {
        title: "Xem khách đã lưu trữ",
        steps: [
          "Bấm **Xem khách đã lưu trữ** phía trên bảng.",
          "Bấm tên khách để xem hồ sơ, công nợ và đơn cũ.",
          "Bấm **Xem khách đang hoạt động** để quay lại.",
        ],
        result:
          "Khách đã lưu trữ vẫn xem được đầy đủ nhưng không chọn được khi tạo đơn mới. Muốn dùng lại, nhờ Giám đốc bấm **Khôi phục**.",
      },
    ],
    terms: [
      {
        term: "**Mã** / **Mã khách hàng**",
        meaning:
          "Mã khách trên sổ kế toán. Không bắt buộc, nhưng mỗi mã chỉ dùng cho một khách; chữ thường tự đổi thành chữ hoa.",
      },
      {
        term: "MST",
        meaning: "Mã số thuế, hiện cạnh mã khách ở đầu trang chi tiết.",
      },
      {
        term: "**Tiền** / **Loại tiền thường dùng**",
        meaning:
          "Loại tiền khách hay dùng (USD hoặc VND). Chỉ để chọn sẵn trong các mẫu nhập. **— Chưa xác định —** là chưa chọn.",
      },
      {
        term: "USD, VND",
        meaning: "Đô la Mỹ và đồng Việt Nam.",
      },
      {
        term: "**Đã lưu trữ**",
        meaning:
          "Khách đã ngừng dùng: vẫn xem được nhưng không hiện trong ô chọn khách khi tạo đơn.",
      },
      {
        term: "**Đã xuất hóa đơn**",
        meaning: "Tổng giá trị hóa đơn (INV) đã lập cho khách.",
      },
      {
        term: "INV",
        meaning: "Hóa đơn bán hàng xuất cho khách.",
      },
      {
        term: "**Đã thu**",
        meaning: "Tổng tiền khách đã trả.",
      },
      {
        term: "**Đã hoàn**",
        meaning: "Tiền đã trả lại cho khách; dòng này chỉ hiện khi có.",
      },
      {
        term: "**Còn phải thu**",
        meaning:
          "Phần khách còn nợ trên hóa đơn. Ghi chú “(n hóa đơn quá hạn)” cho biết số hóa đơn đã quá hạn thanh toán.",
      },
      {
        term: "**Trả trước / dư**",
        meaning:
          "Tiền khách trả trước hoặc trả thừa chưa dùng vào hóa đơn nào.",
      },
      {
        term: "**Cân đối**",
        meaning:
          "Con số chốt giữa nợ và tiền trả dư. Chữ đỏ là khách còn nợ; chữ xanh là khách không nợ hoặc đang dư tiền.",
      },
      {
        term: "Cột **Loại**: **Thu** / **Chi**",
        meaning:
          "**Thu** là phiếu thu tiền khách trả; **Chi** là phiếu hoàn tiền cho khách.",
      },
      {
        term: "**Hạng mục**",
        meaning:
          "Nội dung phiếu, ví dụ **Khách thanh toán** hoặc **Hoàn tiền khách**. Ghi chú của phiếu hiện nhỏ ngay bên dưới.",
      },
      {
        term: "**Đối tác**",
        meaning: "Tên người hoặc đơn vị trả tiền, nhận tiền trên phiếu.",
      },
      {
        term: "**Phân bổ**: **Đã phân bổ** / **Chưa phân bổ**",
        meaning:
          "Tiền của phiếu thu đã được chia hết vào hóa đơn hay đơn hàng chưa; **Chưa phân bổ** kèm số tiền còn lại.",
      },
      {
        term: "**Hình thức**",
        meaning: "**Chuyển khoản**, **Tiền mặt** hoặc **Khác**.",
      },
    ],
    tips: [
      {
        text: "Thêm khách trước khi tạo đơn: ô chọn khách ở trang tạo đơn chỉ lấy khách đang hoạt động trong danh sách này.",
      },
      {
        text: "Trước khi thêm khách, bấm Ctrl+F và gõ tên khách để chắc khách chưa có, vì danh sách không có ô tìm kiếm.",
      },
      {
        text: "Lỗi hay gặp: “Mã khách hàng này đã tồn tại.” — mã đã dùng cho khách khác, hãy đổi mã; “Dữ liệu nhập chưa hợp lệ (kiểm tra email, mã).” — thường do email sai dạng.",
      },
      {
        text: "“Hồ sơ đã thay đổi trong lúc bạn thao tác. Trang đã tải lại, kiểm tra rồi thử lại.” — người khác vừa sửa khách này; đọc lại rồi sửa lại. “Hệ thống tạm thời không phản hồi.” — chờ ít phút rồi thử lại.",
      },
      {
        text: "Lỗi phần tiền: “Số tiền hoàn lớn hơn số khách đang trả dư.” — giảm số tiền hoàn; “Số tiền không hợp lệ với loại tiền đã chọn.” — kiểm tra lại số và loại tiền.",
      },
      {
        text: "Gõ số tiền không có dấu phân cách hàng nghìn, ví dụ 1500000; phần lẻ dùng dấu chấm.",
      },
      {
        text: "Chỉ ghi hoàn tiền khi tiền đã thực sự chuyển trả, vì phiếu hoàn không hủy được trên trang này.",
      },
      {
        text: "Điền **Loại tiền thường dùng** để các mẫu nhập liên quan chọn sẵn đúng loại tiền.",
      },
      {
        text: "Trên trang khách, “Chưa có hóa đơn hay tiền thu nào.” nghĩa là khách chưa có hóa đơn hay phiếu thu; “Chưa có đơn hàng nào.” nghĩa là chưa có đơn nào chọn khách này; “Chưa có phiếu nào trong phạm vi của bạn.” nghĩa là chưa có phiếu tiền nào của khách.",
      },
    ],
  },
  {
    path: "/suppliers",
    title: "Nhà cung cấp",
    summary:
      "Danh sách nhà cung cấp mà bạn chọn khi ghi chi phí mua hàng, nhờ đó chi phí cộng được theo từng nhà cung cấp. Bạn tự thêm nhà cung cấp mới, sửa thông tin và xem các khoản đã chi cho từng nhà cung cấp.",
    layout: [
      {
        text: "Đầu trang có tiêu đề **Danh sách nhà cung cấp** và đoạn giới thiệu.",
      },
      {
        text: "Khung **Thêm nhà cung cấp** là mẫu nhập gồm **Tên nhà cung cấp**, **Mã nhà cung cấp**, **Mã số thuế**, **Cung cấp gì (vật tư, gia công, vận chuyển…)**, **Người liên hệ**, **Điện thoại**, **Email**, **Địa chỉ** và **Ghi chú**.",
      },
      {
        text: "Dòng chữ **Xem nhà cung cấp đã lưu trữ** mở danh sách **Nhà cung cấp đã lưu trữ**; ở đó dòng **Xem nhà cung cấp đang hoạt động** đưa bạn quay lại.",
      },
      {
        text: "Bảng nhà cung cấp có các cột **Mã**, **Tên**, **Cung cấp** và **Liên hệ** (người liên hệ · điện thoại). Bấm tên để mở trang chi tiết.",
      },
      {
        text: "Trang chi tiết: tên nhà cung cấp, dòng mã · MST · mặt hàng cung cấp ở đầu trang (kèm nhãn **Đã lưu trữ** nếu có), phần **Chi phí đã ghi cho nhà cung cấp này** và thẻ **Thông tin** để sửa hồ sơ.",
      },
      {
        text: "Phần chi phí có dòng **Tổng đã chi (phiếu còn hiệu lực)** và bảng phiếu chi với các cột **Ngày**, **Hạng mục**, **Đơn hàng**, **Đối tác**, **Số tiền**, **Hình thức**, **Thao tác**.",
      },
      {
        text: "Dòng **← Danh sách nhà cung cấp** ở đầu trang chi tiết đưa bạn về danh sách.",
      },
    ],
    capabilities: [
      {
        text: "Thêm nhà cung cấp mới ngay trên danh sách.",
      },
      {
        text: "Xem danh sách nhà cung cấp đang hoạt động và đã lưu trữ.",
      },
      {
        text: "Mở hồ sơ nhà cung cấp để sửa mọi thông tin trong thẻ **Thông tin** rồi bấm **Lưu thay đổi**.",
      },
      {
        text: "Xem tổng tiền đã chi cho nhà cung cấp, cộng riêng theo từng loại tiền.",
      },
      {
        text: "Xem từng phiếu chi đã ghi cho nhà cung cấp, kể cả phiếu đã hủy (hiện mờ, ghi **Đã hủy** kèm lý do).",
      },
      {
        text: "Bấm mã đơn ở cột **Đơn hàng** để mở đơn mà khoản chi gắn vào.",
      },
    ],
    limits: [
      {
        text: "Bạn không lưu trữ hay khôi phục được nhà cung cấp; nút **Lưu trữ nhà cung cấp** và **Khôi phục** chỉ hiện với Giám đốc.",
      },
      {
        text: "Không xóa được nhà cung cấp.",
      },
      {
        text: "Không ghi hay hủy phiếu chi trên trang này; cột **Thao tác** chỉ hiện “—”. Ghi phiếu chi ở **Chi phí đơn hàng**; hủy phiếu chi do Kế toán công ty làm.",
      },
      {
        text: "Danh sách không có ô tìm kiếm hay bộ lọc, ngoài việc chuyển giữa nhà cung cấp đang hoạt động và đã lưu trữ.",
      },
      {
        text: "Phiếu chi gõ tay tên đối tác mà không chọn nhà cung cấp trong danh sách sẽ không hiện ở trang nhà cung cấp.",
      },
    ],
    flows: [
      {
        title: "Thêm nhà cung cấp mới",
        when: "Khi bắt đầu mua hàng hoặc thuê gia công từ một nơi chưa có trong danh sách.",
        steps: [
          "Mở **Nhà cung cấp** trong menu.",
          "Nhập **Tên nhà cung cấp** (bắt buộc).",
          "Nhập **Mã nhà cung cấp**, hoặc để trống nếu chưa có.",
          "Nhập **Mã số thuế** nếu có.",
          "Ghi mặt hàng vào ô **Cung cấp gì (vật tư, gia công, vận chuyển…)**.",
          "Nhập **Người liên hệ**, **Điện thoại**, **Email**, **Địa chỉ** nếu có.",
          "Ghi **Ghi chú** nếu cần.",
          "Bấm **Thêm nhà cung cấp**.",
        ],
        result:
          "Trang chi tiết của nhà cung cấp mới mở ra với dòng xanh “Đã thêm nhà cung cấp.” Từ giờ bạn chọn được nhà cung cấp này khi ghi chi phí.",
      },
      {
        title: "Sửa thông tin nhà cung cấp",
        steps: [
          "Bấm tên nhà cung cấp trong danh sách.",
          "Kéo xuống thẻ **Thông tin**.",
          "Sửa các ô cần đổi.",
          "Bấm **Lưu thay đổi**.",
        ],
        result: "Dòng xanh “Đã lưu.” hiện ra.",
      },
      {
        title: "Xem đã chi bao nhiêu cho một nhà cung cấp",
        when: "Khi đối chiếu với nhà cung cấp hoặc tổng hợp chi phí mua hàng.",
        steps: [
          "Bấm tên nhà cung cấp trong danh sách.",
          "Đọc dòng **Tổng đã chi (phiếu còn hiệu lực)**.",
          "Xem từng phiếu trong bảng: **Ngày**, **Hạng mục**, **Đơn hàng**, **Số tiền**.",
          "Bấm mã đơn ở cột **Đơn hàng** nếu cần xem đơn của khoản chi.",
        ],
        result:
          "Bạn có tổng chi và danh sách phiếu chi của nhà cung cấp. Phiếu đã hủy vẫn hiện mờ nhưng không cộng vào tổng.",
      },
      {
        title: "Xem nhà cung cấp đã lưu trữ",
        steps: [
          "Bấm **Xem nhà cung cấp đã lưu trữ** phía trên bảng.",
          "Bấm tên để xem hồ sơ và chi phí cũ.",
          "Bấm **Xem nhà cung cấp đang hoạt động** để quay lại.",
        ],
        result:
          "Muốn dùng lại một nhà cung cấp đã lưu trữ, nhờ Giám đốc bấm **Khôi phục**.",
      },
    ],
    terms: [
      {
        term: "**Mã** / **Mã nhà cung cấp**",
        meaning:
          "Mã ngắn dùng trên hồ sơ mua hàng. Không bắt buộc, nhưng mỗi mã chỉ dùng cho một nhà cung cấp; chữ thường tự đổi thành chữ hoa.",
      },
      {
        term: "MST",
        meaning: "Mã số thuế, hiện ở đầu trang chi tiết.",
      },
      {
        term: "**Cung cấp**",
        meaning:
          "Mặt hàng hoặc dịch vụ nhà cung cấp làm cho công ty: vật tư, gia công, vận chuyển, đóng gói…",
      },
      {
        term: "**Liên hệ**",
        meaning: "Tên người liên hệ và số điện thoại.",
      },
      {
        term: "**Đã lưu trữ**",
        meaning:
          "Nhà cung cấp đã ngừng dùng; vẫn xem được hồ sơ và chi phí cũ.",
      },
      {
        term: "**Tổng đã chi (phiếu còn hiệu lực)**",
        meaning:
          "Tổng các phiếu chi chưa bị hủy của nhà cung cấp, cộng riêng theo từng loại tiền (VND, USD).",
      },
      {
        term: "**Hạng mục**",
        meaning:
          "Loại chi phí: **Nguyên vật liệu**, **Nhân công**, **Gia công ngoài**, **Vận chuyển**, **Đóng gói** hoặc **Chi phí chung**.",
      },
      {
        term: "**Đối tác**",
        meaning: "Tên bên nhận tiền ghi trên phiếu chi.",
      },
      {
        term: "**Hình thức**",
        meaning: "**Chuyển khoản**, **Tiền mặt** hoặc **Khác**.",
      },
      {
        term: "**Đã hủy**",
        meaning: "Phiếu chi đã bị hủy, kèm lý do; không còn tính vào tổng.",
      },
    ],
    tips: [
      {
        text: "Khi ghi chi phí ở **Chi phí đơn hàng**, hãy chọn nhà cung cấp trong danh sách thay vì gõ tay tên, để khoản chi hiện trong trang nhà cung cấp và cộng vào tổng.",
      },
      {
        text: "Trước khi thêm, bấm Ctrl+F và gõ tên để chắc nhà cung cấp chưa có, vì danh sách không có ô tìm kiếm.",
      },
      {
        text: "Điền ô **Cung cấp gì (vật tư, gia công, vận chuyển…)** để cột **Cung cấp** trong danh sách dễ dò.",
      },
      {
        text: "“Chưa có phiếu nào trong phạm vi của bạn.” ở trang chi tiết nghĩa là chưa có phiếu chi nào chọn nhà cung cấp này.",
      },
      {
        text: "Lỗi hay gặp: “Mã nhà cung cấp này đã tồn tại.” — đổi mã khác; “Dữ liệu nhập chưa hợp lệ (kiểm tra email, mã).” — thường do email sai dạng.",
      },
      {
        text: "“Hồ sơ đã thay đổi trong lúc bạn thao tác. Trang đã tải lại, kiểm tra rồi thử lại.” — người khác vừa sửa nhà cung cấp này; đọc lại rồi sửa lại. “Hệ thống tạm thời không phản hồi.” — chờ ít phút rồi thử lại.",
      },
    ],
  },
];
