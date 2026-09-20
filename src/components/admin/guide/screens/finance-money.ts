import type { ScreenGuide } from "../guide-types";

export const financeMoneyScreens: readonly ScreenGuide[] = [
  {
    path: "/finance",
    title: "Tổng quan tài chính",
    summary:
      "Màn hình xem nhanh tiền của công ty: doanh thu theo hóa đơn (INV), tiền đã thu, tiền đã chi, tiền khách còn nợ, tiền khách trả dư và số hóa đơn quá hạn. Màn hình chỉ để xem, không ghi hay sửa gì ở đây.",
    layout: [
      {
        text: "Trên cùng là tiêu đề **Tổng quan tài chính** và một đoạn giải thích ngắn cách tính số liệu.",
      },
      {
        text: "Sáu ô số liệu: **Doanh thu (theo hóa đơn)**, **Đã thu**, **Đã chi**, **Còn phải thu**, **Khách trả trước / trả dư** và **Hóa đơn quá hạn**.",
      },
      {
        text: "Dưới ô **Doanh thu (theo hóa đơn)** có dòng nhỏ **Quy đổi VND** — tổng doanh thu đổi hết ra tiền Việt theo tỷ giá ghi trên từng hóa đơn USD.",
      },
      {
        text: "Các ô tiền tách riêng từng loại tiền, ví dụ “12.500,00 US$ · 350.000.000 ₫”. Tiền USD và VND không bao giờ cộng lẫn vào nhau. Ô chưa có số liệu hiện “—”. Riêng ô **Hóa đơn quá hạn** là số lượng hóa đơn, không phải số tiền.",
      },
      {
        text: "Ba nút đi nhanh: **Hóa đơn** (mở màn hình Hóa đơn (INV)), **Công nợ** (mở màn hình Công nợ khách hàng) và **Sổ thu – chi** (mở màn hình Thu – Chi).",
      },
      {
        text: "Cuối trang là bảng **Phiếu gần đây** với 10 phiếu thu, phiếu chi có ngày gần nhất (kể cả phiếu đã hủy). Các cột: **Ngày**, **Loại**, **Hạng mục**, **Đơn hàng**, **Đối tác**, **Số tiền**, **Hình thức**, **Thao tác**.",
      },
    ],
    capabilities: [
      {
        text: "Xem tổng doanh thu của các hóa đơn còn hiệu lực, tách theo USD và VND, kèm số quy đổi ra VND.",
      },
      {
        text: "Xem tổng tiền đã thu (tiền khách thanh toán và các khoản thu khác) và tổng tiền đã chi (chi phí và tiền hoàn cho khách). Phiếu đã hủy không được tính.",
      },
      {
        text: "Xem tổng tiền khách còn nợ trên các hóa đơn, tổng tiền khách đang trả trước hoặc trả dư, và số hóa đơn đã quá hạn mà vẫn còn thiếu tiền.",
      },
      {
        text: "Xem 10 phiếu gần nhất. Bấm mã đơn ở cột **Đơn hàng** để mở đơn hàng; với phiếu của khách hàng, bấm tên ở cột **Đối tác** để mở trang khách hàng.",
      },
      {
        text: "Bấm **Hóa đơn**, **Công nợ** hoặc **Sổ thu – chi** để sang màn hình chi tiết.",
      },
    ],
    limits: [
      {
        text: "Không ghi phiếu, không lập hóa đơn và không hủy gì ở màn hình này. Cột **Thao tác** của bảng **Phiếu gần đây** luôn là “—” (hoặc **Đã hủy** kèm lý do với phiếu đã hủy).",
      },
      {
        text: "Muốn hủy một phiếu, hãy mở màn hình **Thu – Chi** hoặc **Tiền khách trả**. Muốn hủy hóa đơn, mở **Hóa đơn (INV)**.",
      },
      {
        text: "Màn hình không lọc theo tháng hay theo khách. Muốn xem theo từng hóa đơn hoặc từng khách, mở **Công nợ khách hàng**.",
      },
      {
        text: "Đây chưa phải báo cáo lãi lỗ. Các ô chỉ cho biết doanh thu, tiền thu, tiền chi và công nợ.",
      },
    ],
    flows: [
      {
        title: "Xem nhanh tình hình tiền đầu ngày",
        when: "Mỗi sáng, hoặc trước khi báo cáo cho Giám đốc.",
        steps: [
          "Bấm **Tổng quan tài chính** trên menu.",
          "Đọc ô **Còn phải thu** để biết khách còn nợ bao nhiêu.",
          "Đọc ô **Hóa đơn quá hạn**. Nếu số này lớn hơn 0 (chữ đỏ), có hóa đơn đã quá hạn mà khách chưa trả đủ.",
          "Bấm **Công nợ** để xem hóa đơn nào quá hạn và của khách nào.",
          "Quay lại, đọc ô **Khách trả trước / trả dư** để biết tiền khách đã chuyển mà chưa hóa đơn nào dùng tới.",
          "Kéo xuống bảng **Phiếu gần đây** để kiểm tra các phiếu vừa ghi có đúng không.",
        ],
        result:
          "Bạn nắm được tiền đã thu, đã chi và công nợ. Màn hình không thay đổi dữ liệu nào.",
      },
      {
        title: "Xử lý khi thấy dòng “Thiếu tỷ giá trên một số hóa đơn USD”",
        when: "Dòng này hiện cạnh **Quy đổi VND** trong ô **Doanh thu (theo hóa đơn)**. Hóa đơn lập mới luôn có tỷ giá, nên dòng này thường do hóa đơn cũ.",
        steps: [
          "Bấm **Hóa đơn** để mở danh sách hóa đơn.",
          "Tìm hóa đơn USD mà cột **Tỷ giá** đang là “—”.",
          "Bấm mã đơn ở cột **Đơn hàng** và kiểm tra đơn chưa đóng hồ sơ. Đơn đã đóng hồ sơ thì không lập lại được hóa đơn, nên đừng hủy hóa đơn đó.",
          "Quay lại, bấm số hóa đơn để mở trang chi tiết, nhập lý do vào ô **Lý do hủy** rồi bấm **Hủy hóa đơn này**.",
          "Lập lại hóa đơn cùng số trong khung **Lập hóa đơn**, lần này có tỷ giá: nhập vào ô **Tỷ giá VND/USD**, hoặc để trống nếu bảng tỷ giá đã có tỷ giá của ngày lập hay ngày trước đó.",
          "Mở lại **Tổng quan tài chính** và kiểm tra dòng cảnh báo đã hết.",
        ],
        result:
          "Số **Quy đổi VND** đã tính đủ mọi hóa đơn USD. Nếu hóa đơn cũ đã có tiền khách trả gắn vào, bạn cần phân bổ lại khoản tiền đó vào hóa đơn mới (xem màn hình Tiền khách trả).",
      },
    ],
    terms: [
      {
        term: "INV",
        meaning:
          "Hóa đơn xuất cho khách. Doanh thu được ghi theo giá trị hóa đơn, không theo tiền đã thu.",
      },
      {
        term: "USD / VND",
        meaning:
          "USD là đô la Mỹ, VND là tiền Việt Nam. Hệ thống chỉ dùng hai loại tiền này và luôn tính tổng riêng cho từng loại.",
      },
      {
        term: "Doanh thu (theo hóa đơn)",
        meaning:
          "Tổng giá trị các hóa đơn còn hiệu lực. Hóa đơn đã hủy và hóa đơn của đơn hàng đã hủy không được tính.",
      },
      {
        term: "Quy đổi VND",
        meaning:
          "Doanh thu đổi hết ra tiền Việt. Hóa đơn USD dùng tỷ giá ghi trên chính hóa đơn đó, nên số này không đổi khi bảng tỷ giá thay đổi về sau.",
      },
      {
        term: "Đã thu",
        meaning:
          "Tổng các phiếu thu còn hiệu lực: tiền khách thanh toán và các khoản thu khác.",
      },
      {
        term: "Đã chi",
        meaning:
          "Tổng các phiếu chi còn hiệu lực: chi phí đơn hàng, chi phí chung và tiền hoàn cho khách.",
      },
      {
        term: "Còn phải thu",
        meaning:
          "Tổng phần còn thiếu của các hóa đơn: giá trị hóa đơn trừ tiền đã gắn vào hóa đơn đó (kể cả tiền cọc của đơn).",
      },
      {
        term: "Khách trả trước / trả dư",
        meaning:
          "Tiền khách đã chuyển nhưng chưa được hóa đơn nào dùng hết, trừ đi tiền đã hoàn cho khách. Ví dụ khách chuyển trước, chuyển gộp chưa chia, trả nhiều hơn hóa đơn, hoặc tiền đang gắn vào hóa đơn đã hủy.",
      },
      {
        term: "Hóa đơn quá hạn",
        meaning: "Số hóa đơn đã qua hạn thanh toán mà vẫn còn thiếu tiền.",
      },
      {
        term: "Loại: Thu / Chi",
        meaning:
          "**Thu** (chữ xanh) là tiền vào công ty, **Chi** (chữ đỏ) là tiền ra khỏi công ty.",
      },
      {
        term: "Hạng mục",
        meaning:
          "Nhóm của phiếu, ví dụ **Khách thanh toán**, **Thu khác**, **Nguyên vật liệu**, **Nhân công**, **Gia công ngoài**, **Vận chuyển**, **Đóng gói**, **Chi phí chung**, **Hoàn tiền khách**.",
      },
      {
        term: "Hình thức",
        meaning: "Cách trả tiền: **Chuyển khoản**, **Tiền mặt** hoặc **Khác**.",
      },
    ],
    tips: [
      {
        text: "Các ô **Đã thu** và **Đã chi** được tính trên tối đa 500 phiếu có ngày gần nhất. Khi sổ đã rất nhiều phiếu, hãy đối chiếu thêm ở màn hình **Thu – Chi**.",
      },
      {
        text: "Số trong ô **Còn phải thu** chỉ giảm khi tiền được gắn vào hóa đơn. Tiền khách chuyển mà chưa phân bổ nằm ở ô **Khách trả trước / trả dư**, chưa trừ vào hóa đơn nào.",
      },
      {
        text: "Phiếu mờ trong bảng **Phiếu gần đây** là phiếu đã hủy; nó vẫn nằm trong sổ để đối chiếu nhưng không được cộng vào số liệu.",
      },
    ],
  },
  {
    path: "/finance/invoices",
    title: "Hóa đơn (INV)",
    summary:
      "Nơi lập hóa đơn (INV) cho đơn hàng, tải file hóa đơn lên và hủy hóa đơn lập sai. Doanh thu của công ty được ghi theo các hóa đơn ở đây. Kế toán nhà máy lập INV cho hàng xuất khẩu; Kế toán công ty theo dõi thêm mỗi hóa đơn còn thiếu bao nhiêu.",
    layout: [
      {
        text: "Đầu trang: tiêu đề **Hóa đơn (INV)**, đoạn giải thích và dòng **Tổng doanh thu (hóa đơn còn hiệu lực)** kèm **Quy đổi VND**.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Đầu trang: tiêu đề **Hóa đơn (INV)**, đoạn giải thích và dòng **Tổng doanh thu (hóa đơn còn hiệu lực)**.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Khung **Lập hóa đơn** gồm các ô **Đơn hàng**, **Số hóa đơn (INV)**, **Ngày lập**, **Hạn thanh toán**, **Giá trị hóa đơn**, **Tiền tệ**, **Tỷ giá VND/USD**, **Ghi chú** và nút **Lập hóa đơn**.",
      },
      {
        text: "Bảng hóa đơn, ngày lập mới nhất ở trên cùng, với các cột **Số hóa đơn**, **Đơn hàng**, **Khách hàng**, **Ngày lập**, **Hạn**, **Giá trị**, **Tỷ giá**, **Còn thiếu**, **Thao tác**.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Bảng hóa đơn, ngày lập mới nhất ở trên cùng, với các cột **Số hóa đơn**, **Đơn hàng**, **Khách hàng**, **Ngày lập**, **Hạn**, **Giá trị**, **Tỷ giá**, **Thao tác**. Dòng mờ là hóa đơn đã hủy, cột **Thao tác** ghi lý do hủy.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Cột **Còn thiếu** ghi số tiền còn thiếu (thêm chữ **Quá hạn** nếu đã qua hạn), hoặc **Đã đủ**, hoặc **Đã hủy**. Dòng tô nền đỏ nhạt là hóa đơn quá hạn còn thiếu tiền. Dòng mờ là hóa đơn đã hủy, cột **Thao tác** ghi lý do hủy.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Bấm số hóa đơn để mở trang chi tiết. Trang chi tiết có: nút **← Hóa đơn** để quay lại, thông tin hóa đơn, khung **File hóa đơn**, khung **Các lần khách trả cho hóa đơn này**. Với hóa đơn còn hiệu lực có thêm khung **Hủy hóa đơn**, và khung **Ghi tiền khách trả cho hóa đơn này** khi hóa đơn còn thiếu tiền.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Bấm số hóa đơn để mở trang chi tiết. Trang chi tiết có: nút **← Hóa đơn** để quay lại, thông tin hóa đơn và khung **File hóa đơn**. Với hóa đơn còn hiệu lực có thêm khung **Hủy hóa đơn**.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Ở góc phải trang chi tiết là dòng **Còn thiếu** với số tiền (chữ đỏ) hoặc **Đã thanh toán đủ** (chữ xanh), có thêm chữ **Quá hạn** nếu đã qua hạn. Hóa đơn đã hủy hiện nhãn **Hóa đơn đã hủy** kèm lý do.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
    ],
    capabilities: [
      {
        text: "Lập hóa đơn cho một đơn hàng đang chạy (chưa đóng hồ sơ, chưa hủy). Một đơn có thể có nhiều hóa đơn, mỗi hóa đơn một hạn thanh toán riêng.",
      },
      {
        text: "Chọn loại tiền **VND** hoặc **USD**. Hóa đơn USD luôn giữ tỷ giá của ngày lập: bạn nhập vào ô **Tỷ giá VND/USD**, hoặc để trống để lấy tỷ giá từ bảng tỷ giá.",
      },
      {
        text: "Xem từng hóa đơn còn thiếu bao nhiêu, đã đủ hay đã quá hạn ngay trong bảng (cột **Còn thiếu**).",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Hủy hóa đơn còn hiệu lực ngay trong bảng: nhập lý do vào ô **Lý do hủy…** rồi bấm **Hủy**. Hoặc hủy trong trang chi tiết bằng ô **Lý do hủy** và nút **Hủy hóa đơn này**.",
      },
      {
        text: "Bấm mã đơn ở cột **Đơn hàng** để mở đơn hàng; trong trang chi tiết, bấm tên khách để mở trang khách hàng.",
      },
      {
        text: "Trong trang chi tiết: bấm **Tải chứng từ lên** để gắn file hóa đơn (PDF hoặc ảnh JPG, PNG, WEBP); bấm tên file để mở xem; bấm **Gỡ** để bỏ file tải nhầm.",
      },
      {
        text: "Trong trang chi tiết: xem **Đơn hàng**, **Ngày lập**, **Hạn thanh toán**, **Giá trị**, **Tỷ giá VND/USD** và **Quy đổi VND** (với hóa đơn USD), **Đã trả** (tiền khách trả cộng tiền cọc được trừ vào), **Ghi chú**.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Trong trang chi tiết: xem **Đơn hàng**, **Ngày lập**, **Hạn thanh toán**, **Giá trị**, **Tỷ giá VND/USD** và **Quy đổi VND** (với hóa đơn USD), **Ghi chú**.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Trong trang chi tiết: xem từng lần khách trả cho hóa đơn (ngày, số tiền, nút **Mở** để sang phiếu thu) và dòng **Tiền cọc của đơn được trừ vào**.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Trong trang chi tiết: ghi luôn một lần khách trả cho hóa đơn này ở khung **Ghi tiền khách trả cho hóa đơn này**. Khung chỉ hiện khi hóa đơn còn hiệu lực và còn thiếu tiền.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
    ],
    limits: [
      {
        text: "Không sửa được hóa đơn đã lập (số, ngày, giá trị, tỷ giá). Hóa đơn sai thì hủy kèm lý do rồi lập lại. Số của hóa đơn đã hủy được dùng lại cho hóa đơn mới.",
      },
      {
        text: "Không xóa được hóa đơn. Hóa đơn đã hủy vẫn nằm trong danh sách (mờ đi) để đối chiếu, nhưng không tính vào doanh thu và công nợ.",
      },
      {
        text: "Không lập hóa đơn cho đơn hàng đã đóng hồ sơ hoặc đã hủy. Các đơn này không có trong ô **Đơn hàng**.",
      },
      {
        text: "Hóa đơn đã hủy không tải thêm file, không gỡ file và không ghi tiền vào được nữa; file cũ vẫn mở xem được.",
      },
      {
        text: "Không hủy được phiếu thu ở màn hình này. Muốn hủy hoặc chia lại tiền, bấm **Mở** ở dòng tiền trả để sang trang phiếu thu.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Bạn không xem tiền khách đã trả: bảng không có cột **Còn thiếu**, trang chi tiết không có khung **Các lần khách trả cho hóa đơn này** và không có khung ghi tiền. Kế toán công ty theo dõi phần đó.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Lập hay hủy hóa đơn không cần Giám đốc duyệt và không gửi thông báo, email cho khách. Hóa đơn có hiệu lực ngay khi lập.",
      },
      {
        text: "Không nhập danh sách hàng trên hóa đơn ở đây. Hãy tải file INV lên thay vì gõ lại tên hàng.",
      },
    ],
    flows: [
      {
        title: "Lập hóa đơn cho đơn hàng",
        when: "Khi công ty xuất hóa đơn (INV) cho khách, ví dụ theo từng đợt giao hàng hoặc thanh toán.",
        steps: [
          "Bấm **Hóa đơn (INV)** trên menu.",
          "Chọn đơn trong ô **Đơn hàng** (dạng “mã đơn · tên khách”).",
          "Nhập **Số hóa đơn (INV)** đúng như trên hóa đơn giấy hoặc file.",
          "Chọn **Ngày lập** và **Hạn thanh toán** (cả hai mặc định là hôm nay). Hạn không được trước ngày lập.",
          "Nhập **Giá trị hóa đơn**: chỉ gõ số, không dấu phẩy, dùng dấu chấm cho phần lẻ, ví dụ 12500.50. Tiền VND không có số lẻ.",
          "Chọn **Tiền tệ** trùng loại tiền của đơn hàng (mặc định là **USD**).",
          "Nếu là hóa đơn USD: nhập **Tỷ giá VND/USD**, hoặc để trống để lấy tỷ giá trong bảng tỷ giá. Dòng gợi ý dưới ô cho biết tỷ giá hôm nay, hoặc báo bảng chưa có tỷ giá hôm nay. Hóa đơn VND bỏ qua ô này.",
          "Nhập **Ghi chú** nếu cần.",
          "Bấm **Lập hóa đơn**.",
        ],
        result:
          "Trang chi tiết của hóa đơn mới mở ra với thông báo xanh “Đã lập hóa đơn.”. Hóa đơn được tính ngay vào doanh thu và công nợ. Nếu đơn đã có tiền cọc, tiền cọc tự trừ vào các hóa đơn của đơn, hóa đơn có hạn sớm nhất trước. Tiếp theo, bạn nên tải file INV lên.",
      },
      {
        title: "Tải file hóa đơn lên",
        when: "Ngay sau khi lập hóa đơn, hoặc khi có bản PDF hay ảnh chụp hóa đơn.",
        steps: [
          "Bấm số hóa đơn trong bảng để mở trang chi tiết.",
          "Tìm khung **File hóa đơn**.",
          "Bấm **Tải chứng từ lên**.",
          "Chọn file PDF hoặc ảnh (JPG, PNG, WEBP) trên máy.",
          "Chờ nút chạy qua “Đang tải …%” rồi “Đang lưu…”.",
          "Kiểm tra tên file đã hiện trong danh sách, kèm loại file, dung lượng và ngày tải.",
        ],
        result:
          "File nằm cùng hóa đơn. Ai mở hóa đơn đều bấm vào tên file để xem được. Tải lên xong không có thông báo xanh; file hiện ngay trong danh sách là đã lưu.",
      },
      {
        title: "Gỡ file hóa đơn tải nhầm",
        steps: [
          "Mở trang chi tiết hóa đơn.",
          "Trong khung **File hóa đơn**, tìm file tải nhầm.",
          "Bấm **Gỡ** ở cuối dòng file đó (hệ thống không hỏi lại).",
          "Kiểm tra thông báo xanh “Đã gỡ chứng từ.”.",
          "Bấm **Tải chứng từ lên** để tải file đúng.",
        ],
        result: "File nhầm không còn gắn với hóa đơn.",
      },
      {
        title: "Hủy hóa đơn lập sai rồi lập lại",
        when: "Khi hóa đơn sai số tiền, sai ngày, sai tỷ giá, sai đơn hàng hoặc lập trùng.",
        roles: ["FACTORY_ACCOUNTANT"],
        steps: [
          "Tìm hóa đơn sai trong bảng.",
          "Nếu cần lập lại cho cùng đơn, kiểm tra đơn chưa đóng hồ sơ; đơn đã đóng hồ sơ thì không lập được hóa đơn mới.",
          "Nhập lý do vào ô **Lý do hủy…** ở cột **Thao tác** (hoặc mở trang chi tiết và nhập vào ô **Lý do hủy**).",
          "Bấm **Hủy** (hoặc **Hủy hóa đơn này** trong trang chi tiết). Hệ thống không hỏi lại, nên kiểm tra kỹ trước khi bấm.",
          "Kiểm tra thông báo xanh “Đã hủy hóa đơn.” và dòng hóa đơn đã mờ đi.",
          "Lập hóa đơn mới với thông tin đúng. Có thể dùng lại số hóa đơn cũ.",
          "Báo Kế toán công ty nếu hóa đơn cũ đã có tiền khách trả, để phân bổ lại tiền vào hóa đơn mới.",
        ],
        result:
          "Hóa đơn cũ không còn tính vào doanh thu. Tải file INV mới lên trang hóa đơn mới.",
      },
      {
        title: "Hủy hóa đơn lập sai rồi lập lại",
        when: "Khi hóa đơn sai số tiền, sai ngày, sai tỷ giá, sai đơn hàng hoặc lập trùng.",
        roles: ["COMPANY_ACCOUNTANT"],
        steps: [
          "Tìm hóa đơn sai trong bảng.",
          "Nếu cần lập lại cho cùng đơn, kiểm tra đơn chưa đóng hồ sơ; đơn đã đóng hồ sơ thì không lập được hóa đơn mới.",
          "Nhập lý do vào ô **Lý do hủy…** ở cột **Thao tác** (hoặc mở trang chi tiết và nhập vào ô **Lý do hủy**).",
          "Bấm **Hủy** (hoặc **Hủy hóa đơn này** trong trang chi tiết). Hệ thống không hỏi lại, nên kiểm tra kỹ trước khi bấm.",
          "Kiểm tra thông báo xanh “Đã hủy hóa đơn.” và dòng hóa đơn đã mờ đi.",
          "Lập hóa đơn mới với thông tin đúng. Có thể dùng lại số hóa đơn cũ.",
          "Nếu hóa đơn cũ đã có tiền khách trả gắn vào: bấm số hóa đơn cũ, trong khung **Các lần khách trả cho hóa đơn này** bấm **Mở** ở từng dòng, rồi phân bổ lại tiền vào hóa đơn mới.",
        ],
        result:
          "Hóa đơn cũ không còn tính vào doanh thu, công nợ. Tiền từng gắn vào nó trở thành tiền khách trả trước cho đến khi bạn phân bổ lại hoặc hoàn cho khách. Tiền cọc của đơn tự trừ sang hóa đơn mới.",
      },
      {
        title: "Ghi tiền khách trả cho một hóa đơn",
        when: "Khách chuyển tiền để trả đúng một hóa đơn.",
        roles: ["COMPANY_ACCOUNTANT"],
        steps: [
          "Mở trang chi tiết hóa đơn.",
          "Kéo xuống khung **Ghi tiền khách trả cho hóa đơn này**.",
          "Kiểm tra **Số tiền**: ô đã điền sẵn phần còn thiếu, sửa lại theo số khách thực chuyển.",
          "Giữ **Tiền tệ** trùng loại tiền của hóa đơn (ô đã chọn sẵn).",
          "Chọn **Hình thức** (**Chuyển khoản**, **Tiền mặt** hoặc **Khác**).",
          "Chọn **Ngày** khách trả và nhập **Ghi chú** nếu cần.",
          "Bấm **Ghi phiếu**.",
        ],
        result:
          "Trang hóa đơn tải lại với thông báo xanh “Đã ghi phiếu.”. Số **Còn thiếu** giảm, lần trả mới hiện trong khung **Các lần khách trả cho hóa đơn này**. Nếu khách trả nhiều hơn phần giá trị hóa đơn chưa được các phiếu khác trả, phần dư được giữ lại làm tiền khách trả trước (xem ở trang phiếu thu, bấm **Mở**).",
      },
    ],
    terms: [
      {
        term: "INV",
        meaning:
          "Hóa đơn bán hàng xuất cho khách. Doanh thu công ty được ghi theo giá trị hóa đơn.",
      },
      {
        term: "Tỷ giá / Tỷ giá VND/USD",
        meaning:
          "Số tiền Việt đổi được 1 đô la Mỹ. Hóa đơn USD giữ tỷ giá lúc lập và không đổi về sau, kể cả khi bảng tỷ giá được sửa. Hóa đơn VND không có tỷ giá (cột ghi “—”).",
      },
      {
        term: "Quy đổi VND",
        meaning: "Giá trị hóa đơn USD nhân với tỷ giá ghi trên hóa đơn.",
      },
      {
        term: "Hạn / Hạn thanh toán",
        meaning:
          "Ngày cuối cùng khách phải trả đủ hóa đơn. Qua ngày này mà còn thiếu thì hóa đơn bị đánh dấu **Quá hạn**.",
      },
      {
        term: "Còn thiếu",
        meaning:
          "Giá trị hóa đơn trừ tiền khách đã trả cho hóa đơn và tiền cọc của đơn được trừ vào.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        term: "Quá hạn",
        meaning: "Đã qua hạn thanh toán mà hóa đơn vẫn còn thiếu tiền.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        term: "Đã đủ / Đã thanh toán đủ",
        meaning: "Khách đã trả đủ hóa đơn.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        term: "Đã hủy / Hóa đơn đã hủy",
        meaning:
          "Hóa đơn đã bị hủy kèm lý do. Nó vẫn còn trong danh sách để tra cứu nhưng không tính vào doanh thu và công nợ.",
      },
      {
        term: "Đã trả",
        meaning:
          "Tổng tiền khách trả gắn vào hóa đơn cộng tiền cọc của đơn được trừ vào hóa đơn.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        term: "Tiền cọc của đơn được trừ vào",
        meaning:
          "Tiền khách đặt cọc cho đơn hàng. Hệ thống tự trừ tiền cọc vào các hóa đơn của đơn đó, hóa đơn có hạn thanh toán sớm nhất được trừ trước.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        term: "PDF",
        meaning:
          "Loại file tài liệu phổ biến, thường dùng cho hóa đơn điện tử.",
      },
    ],
    tips: [
      {
        text: "Một đơn hàng chỉ dùng một loại tiền. Nếu đơn đã có giá bán hoặc hóa đơn bằng USD mà bạn lập hóa đơn VND (hoặc ngược lại), sẽ báo lỗi “Loại tiền không khớp với đơn hàng hoặc hóa đơn.”.",
      },
      {
        text: "Lỗi “Hóa đơn USD cần tỷ giá. Nhập tỷ giá vào ô hoặc thêm tỷ giá của ngày lập vào bảng tỷ giá.” nghĩa là bảng tỷ giá chưa có tỷ giá nào cho ngày lập hoặc trước đó. Nhập tỷ giá vào ô, hoặc thêm ở màn hình **Tỷ giá USD** rồi lập lại.",
      },
      {
        text: "Khi để trống ô tỷ giá, hóa đơn lấy tỷ giá của ngày lập trong bảng; ngày đó chưa có thì lấy tỷ giá gần nhất trước ngày đó.",
      },
      {
        text: "Lỗi “Số hóa đơn này đã tồn tại.” nghĩa là đang có một hóa đơn còn hiệu lực mang số đó. Kiểm tra lại số, hoặc hủy hóa đơn cũ trước nếu thật sự muốn lập lại.",
      },
      {
        text: "Lỗi “Số tiền không hợp lệ với loại tiền đã chọn.” thường do gõ số lẻ cho tiền VND hoặc quá 2 số lẻ cho USD. Lỗi “Dữ liệu nhập chưa hợp lệ.” thường do giá trị bằng 0 hoặc hạn thanh toán trước ngày lập. Nếu gõ dấu phẩy hay khoảng trắng trong ô số tiền, trình duyệt sẽ không cho gửi.",
      },
      {
        text: "Lỗi “Đơn hàng đã hủy, không ghi nhận tiền thu vào đơn này.” hoặc “Đơn hàng đã đóng hồ sơ.” nghĩa là đơn không còn nhận hóa đơn mới.",
      },
      {
        text: "Lỗi “Bản ghi đã thay đổi trong lúc bạn thao tác. Trang đã tải lại, kiểm tra rồi thử lại.” xảy ra khi người khác vừa sửa cùng hóa đơn. Xem lại thông tin rồi làm lại.",
      },
      {
        text: "Khi tải file mà thấy “Tệp vượt quá dung lượng cho phép.”, hãy nén hoặc chụp lại file nhỏ hơn. Thấy “Tải lên không thành công. Thử lại.” thì kiểm tra mạng, tải lại trang rồi bấm lại.",
      },
      {
        text: "Nút **Hủy** hủy hóa đơn ngay, không hỏi lại. Luôn ghi lý do rõ ràng (ví dụ “Sai số tiền, lập lại số INV-015”) để người sau hiểu.",
      },
      {
        text: "Hóa đơn của đơn hàng đã hủy có cột **Còn thiếu** là “—” vì không còn tính công nợ; trang chi tiết của nó cũng không hiện số **Còn thiếu** và không có khung ghi tiền.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Bạn cũng lập được hóa đơn ngay trong trang đơn hàng (khung **Lập hóa đơn cho đơn này**, chỉ có khi đơn chưa đóng hồ sơ hoặc chưa hủy); hóa đơn lập ở đó cũng hiện ở màn hình này.",
      },
    ],
  },
  {
    path: "/finance/payments",
    title: "Tiền khách trả",
    summary:
      "Nơi ghi từng lần khách chuyển tiền, gắn khoản tiền đó vào hóa đơn (thanh toán) hoặc đơn hàng (đặt cọc), chia một khoản trả gộp cho nhiều hóa đơn, và hủy phiếu ghi sai.",
    layout: [
      {
        text: "Đầu trang: tiêu đề **Tiền khách trả**, đoạn giải thích và dòng **Tổng đã thu (phiếu còn hiệu lực)** tách theo loại tiền.",
      },
      {
        text: "Khung **Ghi phiếu thu của khách** gồm các ô **Gắn vào**, **Khách hàng**, **Số tiền**, **Tiền tệ**, **Hình thức**, **Ngày**, **Ghi chú** và nút **Ghi phiếu**.",
      },
      {
        text: "Bảng phiếu thu, ngày thu gần nhất ở trên (tối đa 200 phiếu), với các cột **Ngày**, **Hạng mục**, **Đơn hàng**, **Đối tác**, **Số tiền**, **Phân bổ**, **Hình thức**, **Thao tác**.",
      },
      {
        text: "Cột **Phân bổ** ghi **Đã phân bổ** (chữ xanh) hoặc **Chưa phân bổ: số tiền** (chữ đỏ). Bấm vào chữ này để mở trang phiếu thu.",
      },
      {
        text: "Trang phiếu thu: nút **← Tiền khách trả** để quay lại; số tiền và tên khách ở trên; khung thông tin **Ngày**, **Hình thức**, **Hạng mục**, **Tỷ giá ngày thu** (phiếu USD), **Ghi chú**; khung **Đang phân bổ** kèm số **Chưa phân bổ**.",
      },
      {
        text: "Với phiếu còn hiệu lực, trang phiếu có thêm khung **Phân bổ tiền vào hóa đơn / đơn hàng** (bảng cột **Hóa đơn**, **Đơn hàng**, **Hạn**, **Giá trị**, **Còn thiếu**, **Phiếu này**, phần **Đặt cọc cho đơn hàng chưa có hóa đơn**, nút **Lưu phân bổ**) và khung **Hủy phiếu**.",
      },
      {
        text: "Phiếu đã hủy hiện mờ trong bảng, cột **Thao tác** ghi **Đã hủy** kèm lý do, cột **Phân bổ** là “—”; trong trang phiếu có nhãn **Phiếu đã hủy**.",
      },
    ],
    capabilities: [
      {
        text: "Ghi phiếu thu và gắn ngay vào một hóa đơn còn thiếu tiền (dòng “HĐ số · mã đơn · khách · còn …”).",
      },
      {
        text: "Ghi phiếu thu làm tiền cọc cho một đơn hàng đang chạy (dòng “Cọc đơn mã đơn · khách”).",
      },
      {
        text: "Ghi phiếu thu chưa gắn vào đâu (chọn **— Chưa gắn (khách trả trước / trả gộp) —**) khi khách trả trước hoặc chuyển gộp cho nhiều đơn; khi đó phải chọn **Khách hàng**.",
      },
      {
        text: "Mở trang phiếu thu để chia tiền cho nhiều hóa đơn và đơn hàng của cùng khách, sửa lại cách chia bất cứ lúc nào, rồi bấm **Lưu phân bổ**.",
      },
      {
        text: "Xem phiếu đang gắn vào đâu (khung **Đang phân bổ**, dòng “HĐ số · mã đơn” hoặc “Cọc · mã đơn”) và còn bao nhiêu **Chưa phân bổ**.",
      },
      {
        text: "Hủy phiếu thu ghi sai: ngay trong bảng (ô **Lý do hủy…** và nút **Hủy phiếu**) hoặc trong trang phiếu (ô **Lý do hủy** và nút **Hủy phiếu này**).",
      },
      {
        text: "Bấm mã đơn ở cột **Đơn hàng** để mở đơn; bấm tên ở cột **Đối tác** để mở trang khách hàng; trong bảng phân bổ, bấm số hóa đơn để mở hóa đơn, bấm mã đơn ở phần đặt cọc để mở đơn hàng.",
      },
    ],
    limits: [
      {
        text: "Không sửa được số tiền, ngày, loại tiền hay khách của phiếu đã ghi. Phiếu sai thì hủy kèm lý do rồi ghi lại. Chỉ riêng cách phân bổ là sửa được.",
      },
      {
        text: "Không xóa được phiếu. Phiếu đã hủy vẫn nằm trong bảng (mờ) nhưng không tính vào tiền đã thu, và không phân bổ được nữa.",
      },
      {
        text: "Không hoàn tiền cho khách ở màn hình này. Hoàn tiền làm ở trang khách hàng (mở từ menu **Khách hàng**, khung **Hoàn tiền cho khách**) hoặc trong trang của đơn hàng đã hủy.",
      },
      {
        text: "Không ghi tiền vào đơn hàng đã hủy, hóa đơn đã hủy, hoặc bằng loại tiền khác với đơn và hóa đơn. Không chia tiền của khách này vào hóa đơn của khách khác.",
      },
      {
        text: "Màn hình này chỉ có tiền khách thanh toán. Các khoản thu khác và các khoản chi nằm ở màn hình **Thu – Chi**.",
      },
      {
        text: "Ghi phiếu, phân bổ hay hủy phiếu không cần Giám đốc duyệt và không gửi thông báo, email cho khách.",
      },
    ],
    flows: [
      {
        title: "Ghi tiền khách trả cho một hóa đơn",
        when: "Khách chuyển tiền để trả một hóa đơn cụ thể.",
        steps: [
          "Bấm **Tiền khách trả** trên menu.",
          "Trong ô **Gắn vào**, chọn dòng hóa đơn đúng (“HĐ số · mã đơn · khách · còn …”).",
          "Để trống ô **Khách hàng** (hệ thống tự lấy khách của hóa đơn).",
          "Nhập **Số tiền** khách thực chuyển, chỉ gõ số, ví dụ 1500000.",
          "Chọn **Tiền tệ** trùng loại tiền của hóa đơn (mặc định **USD**).",
          "Chọn **Hình thức** và **Ngày** khách trả, nhập **Ghi chú** nếu cần (ví dụ nội dung chuyển khoản).",
          "Bấm **Ghi phiếu**.",
        ],
        result:
          "Trang phiếu thu vừa ghi mở ra với thông báo xanh “Đã ghi phiếu.”. Tiền được gắn vào hóa đơn, tối đa bằng phần giá trị hóa đơn chưa được các phiếu khác trả; phần dư (nếu có) hiện ở **Chưa phân bổ** và là tiền khách trả trước.",
      },
      {
        title: "Ghi tiền đặt cọc cho đơn hàng",
        when: "Khách chuyển tiền cọc khi đơn chưa có hóa đơn.",
        steps: [
          "Bấm **Tiền khách trả** trên menu.",
          "Trong ô **Gắn vào**, chọn dòng “Cọc đơn mã đơn · khách”.",
          "Để trống ô **Khách hàng**.",
          "Nhập **Số tiền**, chọn **Tiền tệ** trùng loại tiền của đơn.",
          "Chọn **Hình thức**, **Ngày**, nhập **Ghi chú** nếu cần.",
          "Bấm **Ghi phiếu**.",
        ],
        result:
          "Trang phiếu thu mở ra với thông báo “Đã ghi phiếu.”. Toàn bộ số tiền được ghi làm tiền cọc của đơn. Khi đơn có hóa đơn, tiền cọc tự trừ vào hóa đơn có hạn sớm nhất trước; phần cọc còn thừa là tiền khách trả trước.",
      },
      {
        title: "Ghi khoản khách trả gộp rồi chia cho nhiều hóa đơn",
        when: "Khách chuyển một lần cho nhiều hóa đơn hoặc nhiều đơn hàng, hoặc trả trước khi chưa rõ trả cho hóa đơn nào.",
        steps: [
          "Bấm **Tiền khách trả** trên menu.",
          "Trong ô **Gắn vào**, giữ **— Chưa gắn (khách trả trước / trả gộp) —**.",
          "Chọn khách trong ô **Khách hàng** (bắt buộc khi không gắn vào đâu).",
          "Nhập **Số tiền**, chọn **Tiền tệ**, **Hình thức**, **Ngày**, nhập **Ghi chú** nếu cần.",
          "Bấm **Ghi phiếu**. Trang phiếu thu mở ra.",
          "Ở khung **Phân bổ tiền vào hóa đơn / đơn hàng**, nhập số tiền vào ô cột **Phiếu này** cho từng hóa đơn khách trả.",
          "Nếu có tiền cọc cho đơn, nhập số tiền cạnh mã đơn ở phần **Đặt cọc cho đơn hàng chưa có hóa đơn**.",
          "Kiểm tra tổng các ô không vượt số tiền của phiếu.",
          "Bấm **Lưu phân bổ**.",
        ],
        result:
          "Thông báo xanh “Đã lưu phân bổ.” hiện ra. Khung **Đang phân bổ** liệt kê các hóa đơn, đơn hàng đã nhận tiền; **Chưa phân bổ** là phần còn lại, được tính là tiền khách trả trước.",
      },
      {
        title: "Chia lại tiền của một phiếu thu",
        when: "Gắn nhầm hóa đơn, cần chuyển tiền sang hóa đơn mới lập, hoặc cần phân bổ tiền khách đang trả dư.",
        steps: [
          "Trong bảng, bấm chữ ở cột **Phân bổ** của phiếu cần sửa để mở trang phiếu.",
          "Xem khung **Đang phân bổ** để biết tiền đang nằm ở đâu.",
          "Trong khung **Phân bổ tiền vào hóa đơn / đơn hàng**, xóa số hoặc nhập 0 ở dòng muốn bỏ.",
          "Nhập số tiền mới ở dòng hóa đơn hoặc đơn hàng cần gắn.",
          "Bấm **Lưu phân bổ**.",
          "Kiểm tra lại khung **Đang phân bổ** và số **Chưa phân bổ**.",
        ],
        result:
          "Cách chia mới thay hoàn toàn cách chia cũ. Số tiền của phiếu không đổi; số **Còn thiếu** của các hóa đơn liên quan được tính lại ngay.",
      },
      {
        title: "Hủy phiếu thu ghi sai rồi ghi lại",
        when: "Ghi sai số tiền, sai ngày, sai khách, sai loại tiền, ghi trùng, hoặc tiền thực tế không về.",
        steps: [
          "Tìm phiếu sai trong bảng.",
          "Nhập lý do vào ô **Lý do hủy…** ở cột **Thao tác** (hoặc mở trang phiếu và nhập vào ô **Lý do hủy**).",
          "Bấm **Hủy phiếu** (hoặc **Hủy phiếu này**). Hệ thống không hỏi lại.",
          "Kiểm tra thông báo xanh “Đã hủy phiếu.” và dòng phiếu đã mờ đi.",
          "Ghi lại phiếu đúng bằng khung **Ghi phiếu thu của khách**.",
        ],
        result:
          "Phiếu cũ không còn tính vào tiền đã thu; mọi hóa đơn và đơn hàng nó từng trả lại hiện còn thiếu như trước. Phiếu mới được tính thay.",
      },
    ],
    terms: [
      {
        term: "Phiếu thu",
        meaning: "Bản ghi một lần khách chuyển tiền cho công ty.",
      },
      {
        term: "Phân bổ",
        meaning:
          "Việc chia số tiền của một phiếu thu vào các hóa đơn (thanh toán) và đơn hàng (đặt cọc) của cùng khách. Phân bổ chỉ là ghi sổ, sửa lại được bất cứ lúc nào khi phiếu còn hiệu lực.",
      },
      {
        term: "Đã phân bổ",
        meaning:
          "Toàn bộ tiền của phiếu đã được gắn vào hóa đơn hoặc đơn hàng (kể cả khi hóa đơn đó về sau bị hủy).",
      },
      {
        term: "Chưa phân bổ",
        meaning:
          "Phần tiền của phiếu chưa gắn vào đâu. Phần này là tiền khách trả trước / trả dư: nó làm giảm số **Cân đối** của khách nhưng chưa trừ vào **Còn thiếu** của hóa đơn nào cho đến khi bạn phân bổ.",
      },
      {
        term: "Đặt cọc / Cọc",
        meaning:
          "Tiền gắn vào đơn hàng thay vì hóa đơn. Hệ thống tự trừ tiền cọc vào các hóa đơn của đơn đó, hóa đơn có hạn sớm nhất trước.",
      },
      {
        term: "Phiếu này",
        meaning:
          "Cột trong khung phân bổ: số tiền của phiếu đang mở gắn vào hóa đơn ở dòng đó.",
      },
      {
        term: "Hủy phiếu",
        meaning:
          "Đánh dấu phiếu ghi sai. Phiếu vẫn nằm trong sổ kèm lý do để tra cứu nhưng không tính tiền nữa. Đây là cách duy nhất để sửa số tiền, ngày, loại tiền hay khách của một phiếu đã ghi.",
      },
      {
        term: "Hạng mục: Khách thanh toán",
        meaning:
          "Mọi phiếu ở màn hình này đều thuộc hạng mục tiền khách thanh toán.",
      },
      {
        term: "Đối tác",
        meaning: "Khách hàng đã chuyển tiền.",
      },
      {
        term: "Tỷ giá ngày thu",
        meaning:
          "Với phiếu USD: tỷ giá trong bảng tỷ giá của ngày thu (hoặc ngày gần nhất trước đó), chỉ để tham khảo.",
      },
      {
        term: "Hình thức",
        meaning: "**Chuyển khoản**, **Tiền mặt** hoặc **Khác**.",
      },
      {
        term: "HĐ",
        meaning: "Viết tắt của hóa đơn.",
      },
    ],
    tips: [
      {
        text: "Lỗi “Phiếu thu của khách phải chọn khách hàng.” nghĩa là bạn để trống cả **Gắn vào** lẫn **Khách hàng**. Chọn một trong hai rồi ghi lại.",
      },
      {
        text: "Lỗi “Khách hàng không khớp với đơn hoặc hóa đơn đã chọn.” nghĩa là khách chọn ở ô **Khách hàng** khác khách của hóa đơn, đơn hàng. Khi đã chọn **Gắn vào**, hãy để trống ô **Khách hàng**.",
      },
      {
        text: "Lỗi “Loại tiền không khớp với đơn hàng hoặc hóa đơn.” thường do quên đổi **Tiền tệ**: ô này mặc định là **USD**, khách trả tiền Việt thì phải chọn **VND**.",
      },
      {
        text: "Lỗi “Tổng phân bổ lớn hơn số tiền của phiếu.” nghĩa là tổng các ô bạn nhập vượt số tiền phiếu. Lỗi “Phân bổ nhiều hơn phần còn thiếu của hóa đơn.” nghĩa là một hóa đơn nhận nhiều hơn phần các phiếu khác chưa trả.",
      },
      {
        text: "Lỗi “Hóa đơn đã hủy.” hoặc “Đơn hàng đã hủy, không ghi nhận tiền thu vào đơn này.” khi phân bổ: bỏ dòng đó (để trống hoặc 0) rồi lưu lại.",
      },
      {
        text: "Lỗi “Số tiền không hợp lệ với loại tiền đã chọn.”: tiền VND không có số lẻ, tiền USD tối đa 2 số lẻ, dùng dấu chấm cho phần lẻ.",
      },
      {
        text: "Lỗi “Bản ghi đã thay đổi trong lúc bạn thao tác. Trang đã tải lại, kiểm tra rồi thử lại.”: có người vừa sửa cùng phiếu. Xem lại rồi làm lại.",
      },
      {
        text: "Khung vàng “Phiếu này ghi theo tên khách trước khi có danh sách khách hàng nên không phân bổ được…” xuất hiện ở phiếu cũ. Muốn phân bổ, hãy hủy phiếu đó và ghi lại có chọn khách.",
      },
      {
        text: "Cột **Đơn hàng** chỉ ghi đơn đã chọn lúc ghi phiếu. Tiền chia sau ở trang phiếu không làm đổi cột này; hãy xem cột **Phân bổ** hoặc mở trang phiếu.",
      },
      {
        text: "Trong khung phân bổ chỉ hiện hóa đơn cùng loại tiền với phiếu và đơn hàng chưa đóng hồ sơ, chưa hủy. Khách chưa có hóa đơn hay đơn hàng nào phù hợp sẽ thấy dòng “Khách hàng này chưa có hóa đơn hay đơn hàng nào để phân bổ.”.",
      },
      {
        text: "Tiền đang gắn vào hóa đơn đã hủy hoặc đơn đã đóng hồ sơ, đã hủy không có dòng trong khung phân bổ, nhưng vẫn hiện ở khung **Đang phân bổ**. Khi bạn bấm **Lưu phân bổ**, các khoản đó bị bỏ ra và trở thành **Chưa phân bổ**. Hãy nhập lại số tiền vào dòng đúng trước khi lưu.",
      },
      {
        text: "Mỗi cuối tuần, lướt cột **Phân bổ** tìm các dòng chữ đỏ **Chưa phân bổ** để chia cho hết. Lưu ý: phiếu có tiền gắn vào hóa đơn đã hủy vẫn ghi **Đã phân bổ**; hãy xem cột **Trả trước / dư** ở **Công nợ khách hàng** để phát hiện.",
      },
      {
        text: "Bảng chỉ hiện 200 phiếu gần nhất, và dòng **Tổng đã thu (phiếu còn hiệu lực)** chỉ cộng các phiếu trong bảng. Muốn đối chiếu tiền một khách đã trả, xem cột **Đã thu** ở bảng **Theo khách hàng** của màn hình **Công nợ khách hàng**; cột này cộng đủ mọi phiếu còn hiệu lực.",
      },
      {
        text: "Tiền khách trả dư mà không còn hóa đơn nào để trừ: chỉ hoàn khi thực sự chuyển trả lại tiền, ở khung **Hoàn tiền cho khách** trong trang khách hàng (khung chỉ hiện khi khách đang trả dư). Số hoàn không được vượt số khách đang trả dư.",
      },
    ],
  },
  {
    path: "/finance/receivables",
    title: "Công nợ khách hàng",
    summary:
      "Bảng công nợ của khách theo hóa đơn (INV): mỗi hóa đơn còn thiếu bao nhiêu, hóa đơn nào quá hạn, và mỗi khách đã được xuất hóa đơn bao nhiêu, đã trả, đã được hoàn, đang trả dư bao nhiêu. Màn hình chỉ để xem và đối chiếu.",
    layout: [
      {
        text: "Đầu trang: tiêu đề **Công nợ khách hàng**, đoạn giải thích cách tính, rồi ba số tổng **Tổng còn phải thu**, **Tổng khách trả trước** và **Hóa đơn quá hạn**.",
      },
      {
        text: "Bảng **Theo hóa đơn**, hạn thanh toán sớm nhất ở trên, với các cột **Hóa đơn**, **Đơn hàng**, **Khách hàng**, **Hạn thanh toán**, **Giá trị**, **Đã trả**, **Còn thiếu**, **Trạng thái**.",
      },
      {
        text: "Cột **Trạng thái** có ba nhãn: **Quá hạn** (đỏ), **Đã đủ** (xanh), **Còn nợ** (xám). Dòng quá hạn còn được tô nền đỏ nhạt.",
      },
      {
        text: "Bảng **Theo khách hàng** (xếp theo tên khách), kèm dòng giải thích “Cân đối = còn thiếu trừ trả trước. Âm nghĩa là khách đang trả dư.”. Các cột: **Khách hàng**, **Đã xuất hóa đơn**, **Đã thu**, **Đã hoàn**, **Còn thiếu**, **Trả trước / dư**, **Cân đối**.",
      },
      {
        text: "Mỗi khách có một dòng riêng cho từng loại tiền; mã loại tiền (USD hoặc VND) ghi nhỏ cạnh tên khách.",
      },
    ],
    capabilities: [
      {
        text: "Xem tổng tiền khách còn nợ, tổng tiền khách trả trước và số hóa đơn quá hạn, tách theo loại tiền.",
      },
      {
        text: "Xem từng hóa đơn còn hiệu lực: hạn thanh toán, giá trị, đã trả (tiền trả cộng tiền cọc được trừ), còn thiếu và trạng thái.",
      },
      {
        text: "Xem tổng hợp từng khách: đã xuất hóa đơn, đã thu, đã hoàn, còn thiếu (kèm **Quá hạn ×số hóa đơn** nếu có), trả trước / dư và cân đối.",
      },
      {
        text: "Bấm số hóa đơn để mở hóa đơn; bấm mã đơn để mở đơn hàng; bấm tên khách để mở trang khách hàng.",
      },
    ],
    limits: [
      {
        text: "Màn hình không có nút ghi, sửa hay hủy. Ghi tiền khách trả và phân bổ làm ở **Tiền khách trả**; lập, hủy hóa đơn làm ở **Hóa đơn (INV)**; hoàn tiền làm ở trang khách hàng.",
      },
      {
        text: "Không có ô lọc, tìm kiếm hay xuất file ở màn hình này.",
      },
      {
        text: "Hóa đơn đã hủy và hóa đơn của đơn hàng đã hủy không hiện trong bảng và không tính vào công nợ.",
      },
      {
        text: "Đây là công nợ đơn hàng theo hóa đơn (USD và VND). Công nợ của khách mua sơn nằm ở màn hình khác: **Công nợ bán sơn**.",
      },
    ],
    flows: [
      {
        title: "Rà soát hóa đơn quá hạn để nhắc khách",
        when: "Hằng tuần, hoặc khi số **Hóa đơn quá hạn** lớn hơn 0.",
        steps: [
          "Bấm **Công nợ khách hàng** trên menu.",
          "Đọc số **Hóa đơn quá hạn** ở đầu trang.",
          "Trong bảng **Theo hóa đơn**, tìm các dòng nền đỏ có nhãn **Quá hạn**.",
          "Ghi lại số hóa đơn, khách hàng, **Hạn thanh toán** và số **Còn thiếu**.",
          "Bấm số hóa đơn để mở chi tiết, xem khách đã trả những lần nào.",
          "Trước khi nhắc khách, xem cột **Trả trước / dư** của khách đó ở bảng **Theo khách hàng**, và mở **Tiền khách trả** kiểm tra khách có phiếu nào **Chưa phân bổ** không.",
          "Nếu có tiền chưa dùng, phân bổ khoản đó vào hóa đơn; nếu không, liên hệ nhắc khách thanh toán.",
        ],
        result:
          "Bạn có danh sách hóa đơn cần thu. Hệ thống không tự gửi nhắc nợ; việc liên hệ khách do bạn làm.",
      },
      {
        title: "Đối chiếu công nợ với một khách",
        when: "Khách hỏi còn nợ bao nhiêu, hoặc khi đối chiếu cuối tháng.",
        steps: [
          "Kéo xuống bảng **Theo khách hàng**.",
          "Tìm dòng của khách (mỗi loại tiền một dòng).",
          "Đọc **Đã xuất hóa đơn**, **Đã thu** và **Đã hoàn**.",
          "Đọc **Còn thiếu**: tổng phần chưa trả của các hóa đơn.",
          "Đọc **Trả trước / dư**: tiền khách đã chuyển mà chưa hóa đơn nào dùng hết.",
          "Đọc **Cân đối**: số dương (đỏ) là khách còn nợ, số âm (xanh) là khách đang trả dư.",
          "Nếu cần danh sách chi tiết, tìm các hóa đơn của khách trong bảng **Theo hóa đơn** hoặc bấm tên khách để mở trang khách hàng.",
        ],
        result: "Bạn có số liệu để báo khách hoặc báo Giám đốc.",
      },
      {
        title: "Xử lý khách đang trả dư",
        when: "Cột **Trả trước / dư** của khách lớn hơn 0.",
        steps: [
          "Kiểm tra cột **Còn thiếu** của cùng khách, cùng loại tiền.",
          "Nếu khách vẫn còn hóa đơn thiếu tiền: mở **Tiền khách trả**, tìm phiếu của khách có chữ đỏ **Chưa phân bổ**, hoặc phiếu đang gắn vào hóa đơn đã hủy (xem khung **Đang phân bổ** trong trang phiếu).",
          "Mở phiếu, nhập số tiền vào hóa đơn đang thiếu rồi bấm **Lưu phân bổ**.",
          "Nếu khách không còn hóa đơn nào và công ty thực sự trả lại tiền: bấm tên khách để mở trang khách hàng.",
          "Trong khung **Hoàn tiền cho khách**, kiểm tra số tiền và loại tiền đã điền sẵn, chọn **Hình thức**, **Ngày**, nhập **Ghi chú** nếu cần.",
          "Bấm nút **Hoàn tiền cho khách** và kiểm tra thông báo xanh “Đã ghi phiếu hoàn tiền.”.",
          "Mở lại **Công nợ khách hàng** kiểm tra **Trả trước / dư** và **Cân đối** đã đúng.",
        ],
        result:
          "Tiền dư được dùng trả hóa đơn còn thiếu, hoặc đã được hoàn và hiện ở cột **Đã hoàn**. Phiếu hoàn tiền cũng được tính vào ô **Đã chi** ở **Tổng quan tài chính**.",
      },
    ],
    terms: [
      {
        term: "Còn thiếu",
        meaning:
          "Giá trị hóa đơn trừ tiền đã gắn vào hóa đơn (kể cả tiền cọc của đơn được trừ vào). Ở bảng khách hàng, đây là tổng phần còn thiếu của các hóa đơn.",
      },
      {
        term: "Đã trả",
        meaning:
          "Tiền khách trả gắn thẳng vào hóa đơn cộng tiền cọc của đơn được trừ vào hóa đơn đó.",
      },
      {
        term: "Quá hạn",
        meaning:
          "Hóa đơn đã qua **Hạn thanh toán** mà vẫn còn thiếu tiền. Ở bảng khách hàng, “Quá hạn ×2” nghĩa là khách có 2 hóa đơn quá hạn.",
      },
      {
        term: "Đã đủ",
        meaning: "Hóa đơn không còn thiếu tiền.",
      },
      {
        term: "Còn nợ",
        meaning: "Hóa đơn còn thiếu tiền nhưng chưa tới hạn.",
      },
      {
        term: "Đã xuất hóa đơn",
        meaning: "Tổng giá trị các hóa đơn còn hiệu lực của khách.",
      },
      {
        term: "Đã thu",
        meaning:
          "Tổng tiền khách đã chuyển (các phiếu thu còn hiệu lực), dù đã phân bổ hay chưa.",
      },
      {
        term: "Đã hoàn",
        meaning: "Tổng tiền công ty đã trả lại cho khách.",
      },
      {
        term: "Trả trước / dư",
        meaning:
          "Đã thu trừ đã hoàn trừ phần tiền các hóa đơn đã dùng. Gồm tiền chưa phân bổ, tiền cọc thừa, tiền trả nhiều hơn giá trị hóa đơn, và tiền đang gắn vào hóa đơn đã hủy hoặc đơn hàng đã hủy.",
      },
      {
        term: "Cân đối",
        meaning:
          "Còn thiếu trừ trả trước. Số dương là khách còn nợ; số âm là khách đang trả dư.",
      },
      {
        term: "USD / VND",
        meaning:
          "Đô la Mỹ / tiền Việt Nam. Công nợ luôn tính riêng từng loại tiền, không quy đổi cộng chung.",
      },
    ],
    tips: [
      {
        text: "Tiền cọc gắn vào đơn hàng được hệ thống tự trừ vào hóa đơn của đơn đó (hạn sớm nhất trước). Còn tiền khách chuyển mà chưa phân bổ thì không tự trừ vào hóa đơn: hóa đơn vẫn báo **Còn thiếu** cho tới khi bạn phân bổ ở **Tiền khách trả**.",
      },
      {
        text: "Khi hủy một hóa đơn đã có tiền gắn vào, số tiền đó chuyển sang cột **Trả trước / dư** của khách, dù cột **Phân bổ** ở **Tiền khách trả** vẫn ghi **Đã phân bổ**. Nhớ phân bổ lại vào hóa đơn lập thay.",
      },
      {
        text: "Khi hủy một phiếu thu, các hóa đơn nó từng trả sẽ hiện còn thiếu trở lại. Nếu thấy một hóa đơn bỗng báo **Quá hạn**, kiểm tra xem có phiếu nào vừa bị hủy không.",
      },
      {
        text: "Bảng trống với dòng “Chưa có hóa đơn nào trong phạm vi của bạn.” nghĩa là chưa có hóa đơn nào còn hiệu lực.",
      },
    ],
  },
];
