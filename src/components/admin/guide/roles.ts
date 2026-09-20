import type { SystemRoleKey } from "@/domains/identity/role-definitions";

import type { GuideBasic, RoleGuide } from "./guide-types";

/**
 * The part of the "Hướng dẫn sử dụng website" page that describes each
 * position, and the basics every role shares. Fixed copy for staff who are
 * not technical: every label wrapped in ** is copied from the screen.
 */
export const roleGuides: Record<SystemRoleKey, RoleGuide> = {
  DIRECTOR: {
    key: "DIRECTOR",
    intro: [
      "Giám đốc là người điều hành chung của Red Door. Trên hệ thống, bốn bước của một đơn hàng chỉ đi tiếp khi có bạn duyệt: xác nhận đơn hàng (kèm giá và điều khoản), kế hoạch sản xuất, mua nguyên liệu và xuất hàng. Người trình một yêu cầu không bao giờ tự duyệt được yêu cầu đó, kể cả khi người trình là chính bạn.",
      "Bạn cũng là người mở cửa hệ thống cho nhân sự. Ai đăng nhập bằng Gmail lần đầu sẽ chờ ở **Danh sách nhân sự**; bạn chọn một vai trò cho từng người, khoá hoặc mở khoá tài khoản khi cần. Bạn giao việc cho từng người kèm hạn hoàn thành và trả lời khi họ xin gia hạn.",
      "Menu của bạn dài hơn các vị trí khác. Trên cùng là các mục dùng chung; bên dưới là các nhóm mang tên vai trò. Nhóm Giám đốc chứa các mục riêng của bạn; các nhóm Quản lý nhà máy, Thủ kho / Quản lý kho, Kế toán nhà máy & mua hàng, Kế toán công ty, Biên tập nội dung chứa màn hình làm việc của từng vị trí. Bạn mở được mọi màn hình đó để theo dõi, nhưng hướng dẫn này chỉ mô tả các mục dùng chung và các mục riêng của Giám đốc.",
      "Công việc của bạn nối với mọi vị trí: Kế toán công ty trình đơn hàng, Quản lý nhà máy trình kế hoạch sản xuất, Thủ kho trình mua nguyên liệu và xuất hàng. Các yêu cầu đó về **Phê duyệt**. Khách gửi yêu cầu báo giá từ website thì về **Yêu cầu báo giá**, chỉ bạn xem được.",
    ],
    responsibilities: [
      "Duyệt tài khoản mới, chọn vai trò, khoá và mở khoá nhân sự ở **Danh sách nhân sự**.",
      "Quyết định các yêu cầu đang chờ ở **Phê duyệt**: xác nhận đơn hàng, kế hoạch sản xuất, mua nguyên liệu và xuất hàng.",
      "Giao việc kèm hạn cho từng người và trả lời yêu cầu xin gia hạn ở **Giao việc**.",
      "Làm những việc được giao cho chính mình ở **Công việc được giao**.",
      "Đọc và xử lý yêu cầu báo giá khách gửi từ website ở **Yêu cầu báo giá**.",
      "Tra cứu vị trí, trách nhiệm và quy tắc xem giá ở **Cơ cấu tổ chức**.",
      "Hỏi nhanh số liệu, nhờ trợ lý nháp kế hoạch và việc cần làm ở **Trợ lý AI**, rồi duyệt đề xuất.",
      "Theo dõi màn hình làm việc của từng vị trí qua các nhóm vai trò trong menu.",
    ],
    sees: [
      "Mọi dữ liệu trong hệ thống: đơn hàng, giá bán, giá mua, chi phí, hóa đơn, tiền khách trả, công nợ, kho, nội dung website.",
      "Danh sách mọi tài khoản đã đăng nhập bằng Gmail, kèm vai trò và thời điểm đăng nhập.",
      "Mọi việc đã giao, ai đang làm, việc nào quá hạn, và mọi yêu cầu xin gia hạn.",
      "Hàng đợi phê duyệt của toàn công ty.",
      "Yêu cầu báo giá từ website: nhu cầu, thông tin liên hệ của khách, trạng thái gửi email.",
    ],
    hidden: [
      "Không có số liệu nào của công ty bị ẩn với Giám đốc.",
      "Hội thoại với **Trợ lý AI** của từng người chỉ người đó đọc được, kể cả với Giám đốc. Bạn cũng chỉ thấy hội thoại của chính mình.",
      "Liên kết Zalo là của riêng từng người; mỗi người tự lấy mã liên kết trên màn hình việc của mình.",
      "Tài khoản Giám đốc và tài khoản kiểm thử không quản lý ở **Danh sách nhân sự**: không thể khoá, đổi role hay từ chối.",
    ],
    workflows: [
      {
        title: "Duyệt một nhân viên mới đăng nhập bằng Gmail",
        when: "Khi thẻ **Danh sách nhân sự** ở **Tổng quan** hiện nhãn “… đang chờ duyệt”, hoặc khi nhân viên báo đã đăng nhập.",
        steps: [
          "Bấm thẻ **Danh sách nhân sự** ở trang **Tổng quan**, hoặc bấm mục đó trong menu.",
          "Chọn tab **Chờ duyệt**.",
          "Kiểm tra tên và cột **Gmail** để chắc đúng người.",
          "Chọn vai trò ở ô **Chọn role…** của dòng đó.",
          "Bấm **Duyệt**.",
          "Báo nhân viên tải lại trang để vào hệ thống.",
        ],
        result:
          "Thông báo “Đã duyệt tài khoản.” hiện lên. Người đó chuyển sang tab **Đang làm việc** và thấy đúng menu của vai trò vừa chọn từ lần tải trang kế tiếp. Nếu đó là người lạ, bấm **Từ chối** rồi **Xác nhận từ chối**; nếu họ đăng nhập lại, họ quay lại hàng chờ.",
        links: ["", "/staff"],
      },
      {
        title: "Đổi vai trò, khoá và mở khoá tài khoản",
        when: "Khi một người đổi vị trí, nghỉ việc hoặc quay lại làm.",
        steps: [
          "Mở **Danh sách nhân sự** và chọn tab **Đang làm việc**.",
          "Chọn vai trò mới trong cột **Role** của người đó.",
          "Bấm **Lưu role**.",
          "Để khoá, bấm **Khoá** rồi bấm **Xác nhận khoá**.",
          "Để mở lại, chọn tab **Đã khoá** và bấm **Mở khoá**.",
        ],
        result:
          "Vai trò mới, việc khoá hay mở khoá có hiệu lực từ lần tải trang kế tiếp của người đó. Hệ thống không gửi thông báo cho nhân viên, nên bạn tự báo họ. Khoá giữ lại vai trò cũ để mở khoá sau.",
        links: ["/staff"],
      },
      {
        title: "Giao việc và trả lời yêu cầu xin gia hạn",
        when: "Khi cần một người làm việc gì đó trước một hạn cụ thể.",
        steps: [
          "Mở **Giao việc** và kéo xuống khung **Giao việc mới**.",
          "Nhập nội dung ở ô **Việc** và chọn **Hạn (ngày)**.",
          "Nhập **Mã đơn (tùy chọn)** nếu việc gắn với một đơn hàng.",
          "Chọn **Ưu tiên** và chọn người ở ô **Người làm**.",
          "Bấm **Lưu việc**.",
          "Khi người làm xin dời hạn, đọc yêu cầu trong khung **Xin gia hạn chờ duyệt**.",
          "Nhập **Ghi chú cho người xin (tùy chọn)** nếu muốn.",
          "Bấm **Duyệt gia hạn** hoặc **Từ chối**.",
        ],
        result:
          "Người làm nhận việc qua email và Zalo (nếu đã liên kết) và thấy việc ở **Công việc được giao** của họ. Duyệt gia hạn thì hạn đổi ngay và nhắc việc tính theo hạn mới; từ chối thì hạn giữ nguyên. Người xin nhận câu trả lời qua email và Zalo.",
        links: ["/tasks"],
      },
      {
        title: "Quyết định một yêu cầu phê duyệt",
        when: "Khi một vị trí trình bạn duyệt: xác nhận đơn hàng, kế hoạch sản xuất, mua nguyên liệu hoặc xuất hàng.",
        steps: [
          "Mở **Phê duyệt**.",
          "Đọc từng yêu cầu trong khung **Hàng đợi đang chờ quyết định**: loại yêu cầu, nội dung tóm tắt và thời điểm **Trình lúc**.",
          "Nhập lý do vào ô **Lý do (bắt buộc khi từ chối)** nếu bạn định từ chối.",
          "Bấm **Phê duyệt** hoặc **Từ chối**.",
        ],
        result:
          "Thông báo “Đã ghi nhận quyết định.” hiện lên. Hệ thống không tự chuyển bước đơn hàng và không gửi thông báo cho người trình: họ thấy kết quả khi mở lại đơn, rồi tự chuyển bước. Riêng **Xác nhận đơn hàng**, bước kế tiếp thuộc Giám đốc, nên sau khi duyệt bạn tự mở đơn đó (trong nhóm vai trò của menu) và chuyển đơn sang bước lập kế hoạch sản xuất. Nếu bản ghi gốc đã thay đổi sau khi trình, hệ thống báo “Bản ghi gốc đã thay đổi sau khi trình — yêu cầu phải được trình lại.”",
        links: ["/approvals"],
      },
      {
        title: "Xử lý một yêu cầu báo giá từ website",
        when: "Khi khách gửi form Liên hệ trên website.",
        steps: [
          "Mở **Yêu cầu báo giá** và bấm bộ lọc **Mới**.",
          "Bấm **Mở** ở yêu cầu cần xử lý.",
          "Đọc khung **Nhu cầu** và khung **Khách hàng**.",
          "Bấm **Bắt đầu xử lý**.",
          "Bấm **Trả lời qua email** để viết thư cho khách.",
          "Bấm **Đã gửi báo giá** sau khi đã gửi báo giá cho khách.",
          "Bấm **Đóng yêu cầu** khi đã xong, hoặc **Đánh dấu spam** nếu là thư rác.",
        ],
        result:
          "Trạng thái đổi theo từng nút bấm và được ghi vào khung **Lịch sử**. Ô **Ghi chú nội bộ (tuỳ chọn)** chỉ người trong công ty đọc, khách không thấy.",
        links: ["/quote-requests"],
      },
      {
        title: "Nhờ trợ lý lập kế hoạch rồi duyệt thành việc",
        when: "Khi muốn có danh sách việc cho các bước còn lại của một đơn hàng.",
        steps: [
          "Mở **Trợ lý AI**.",
          "Nhập câu hỏi, ví dụ “Lập kế hoạch cho đơn …” kèm mã đơn, rồi bấm **Gửi**.",
          "Đọc đề xuất và bấm **Giả định** để xem trợ lý đã giả định những gì.",
          "Bấm **Duyệt và tạo việc**, hoặc nhập **Lý do từ chối** rồi bấm **Từ chối**.",
          "Mở **Giao việc** để xem các việc vừa được tạo.",
        ],
        result:
          "Trợ lý chỉ nháp; việc chỉ được tạo khi bạn duyệt. Đề xuất chưa quyết định cũng nằm trong khung **Đề xuất của trợ lý chờ duyệt** ở **Giao việc**.",
        links: ["/assistant", "/tasks"],
      },
    ],
    faq: [
      {
        question:
          "Nhân viên báo đăng nhập xong chỉ thấy “Tài khoản đang chờ Giám đốc duyệt”?",
        answer:
          "Tài khoản của họ đang ở tab **Chờ duyệt** trong **Danh sách nhân sự**. Chọn vai trò, bấm **Duyệt**, rồi báo họ tải lại trang.",
      },
      {
        question: "Vì sao không có vai trò Giám đốc trong ô chọn role?",
        answer:
          "Hệ thống chỉ có một Giám đốc. Vai trò Giám đốc không cấp ở **Danh sách nhân sự**, và tài khoản Giám đốc không thể bị khoá, đổi role hay từ chối.",
      },
      {
        question: "**Khoá** và **Từ chối** khác nhau thế nào?",
        answer:
          "**Từ chối** xoá yêu cầu của một người đang chờ; nếu họ đăng nhập lại, họ quay lại hàng chờ. **Khoá** dành cho người đang làm việc: họ không vào được hệ thống nữa nhưng vai trò được giữ để **Mở khoá** sau.",
      },
      {
        question:
          "Tôi bấm **Phê duyệt** thì báo “Người trình không thể tự quyết định yêu cầu của mình.”?",
        answer:
          "Yêu cầu đó do chính bạn trình. Người trình không bao giờ là người duyệt, kể cả Giám đốc. Yêu cầu vẫn nằm trong hàng đợi.",
      },
      {
        question: "Đổi role hoặc khoá tài khoản có báo cho nhân viên không?",
        answer:
          "Không. Thay đổi có hiệu lực từ lần tải trang kế tiếp của người đó, và bạn tự báo cho họ.",
      },
      {
        question: "Yêu cầu báo giá hiện “· chưa gửi mail” nghĩa là gì?",
        answer:
          "Thư báo về hộp thư công ty chưa gửi được. Yêu cầu vẫn được lưu đầy đủ; bạn mở yêu cầu và bấm **Trả lời qua email** để liên hệ khách.",
      },
      {
        question: "Vì sao hướng dẫn này không có phần của các vị trí khác?",
        answer:
          "Mỗi vai trò chỉ đọc hướng dẫn của mình. Các mục nằm dưới tiêu đề vai trò trong menu của bạn là màn hình làm việc của vị trí đó; bạn mở được để theo dõi, còn cách dùng chi tiết nằm trong hướng dẫn của từng người.",
      },
      {
        question: "Nhắc việc có tự gửi không, hay tôi phải bấm?",
        answer:
          "Khung **Nhắc việc** ở **Giao việc** ghi rõ lịch tự động đã cấu hình hay chưa. Bạn có thể bấm **Chạy nhắc việc ngay** bất cứ lúc nào; dòng báo lỗi thì bấm **Gửi lại**.",
      },
    ],
  },

  WAREHOUSE_MANAGER: {
    key: "WAREHOUSE_MANAGER",
    intro: [
      "Thủ kho / Quản lý kho giữ hai kho của công ty: kho sơn và kho nguyên vật liệu. Mỗi lần nhập, xuất đều được ghi vào hệ thống thay cho các file Excel trước đây, kèm tên người ghi và thời điểm ghi.",
      "Bạn cũng bán sơn tại quầy: lập phiếu bán hàng, in cho khách và ghi công nợ của khách mua sơn. Kế toán công ty cùng theo dõi phiếu bán hàng và công nợ bán sơn với bạn, và là người sửa dư đầu kỳ khi cần.",
      "Trong quy trình mười một bước của một đơn hàng, bạn phụ trách phần kho: cấp vật tư hoặc đặt mua vật tư (bước 4), đóng gói với phiếu đóng gói và ảnh (bước 7), xuất hàng – giao khách (bước 10). Quản lý nhà máy chuyển đơn sang cho bạn sau khi lập kế hoạch; sau khi đóng gói, đơn sang Kế toán nhà máy lập chứng từ xuất hàng.",
      "Đặt mua vật tư phải có Giám đốc duyệt trước khi bạn chuyển bước; rời bước đóng gói cần phiếu đóng gói của bạn và kiểm đóng gói đạt của Quản lý nhà máy.",
    ],
    responsibilities: [
      "Ghi các lần xuất sơn cho cơ sở sản xuất ở **Bảng xuất kho sơn**.",
      "Ghi phiếu nhập, phiếu xuất và giữ danh mục vật tư, cơ sở nhận hàng ở **Nguyên vật liệu**.",
      "Theo dõi tồn kho nguyên vật liệu, nhất là vật tư **Sắp hết** và **Hết hàng**.",
      "Lập, xác nhận và in phiếu bán sơn tại quầy ở **Hóa đơn bán hàng**.",
      "Ghi phát sinh bán hàng và thanh toán của khách mua sơn ở **Công nợ bán sơn**.",
      "Chuyển bước đơn hàng ở phần kho trong **Sổ đơn hàng**: cấp vật tư, đóng gói, xuất hàng; ghi phiếu đóng gói và tải ảnh đóng gói.",
      "Trình Giám đốc duyệt khi đơn cần đặt mua vật tư.",
      "Đối chiếu danh sách đơn hàng từ file Excel ở **Kiểm tra bảng biểu** khi cần.",
      "Làm việc được Giám đốc giao ở **Công việc được giao**.",
    ],
    sees: [
      "Số lượng tồn đầu, nhập, xuất, tồn cuối của từng vật tư.",
      "Đơn giá và thành tiền trên **Bảng xuất kho sơn** và trên phiếu nhập nguyên vật liệu (giá mua).",
      "Giá bán sơn tại quầy trên phiếu bán hàng, và số tiền công nợ của khách mua sơn.",
      "Mã đơn, khách hàng, bước hiện tại, tiến trình và nhật ký chuyển bước của đơn hàng.",
      "Lịch sử chỉnh sửa: ai ghi, sửa hay hủy phiếu nào, lúc nào.",
    ],
    hidden: [
      "Giá bán của đơn hàng: **Sổ đơn hàng** không có cột giá bán, và khung **Giá bán** trên trang đơn ghi “Bạn không có quyền xem giá bán của đơn này.” Chỉ Giám đốc, Kế toán công ty và Kế toán nhà máy xem giá bán.",
      "Hóa đơn (INV), tiền khách trả và công nợ của đơn hàng: do hai vị trí kế toán giữ, nên các khung đó không hiện trên trang đơn hàng của bạn.",
      "Chi phí đã ghi cho từng đơn hàng: Kế toán nhà máy ghi, Quản lý nhà máy và Kế toán công ty theo dõi.",
      "Lợi nhuận của đơn: chỉ Giám đốc. Lương: Giám đốc và Kế toán công ty.",
      "Dư đầu kỳ của công nợ bán sơn: bạn xem được, nhưng chỉ Kế toán công ty và Giám đốc sửa, vì đổi dư đầu kỳ làm thay đổi số dư của cả kỳ.",
      "Các bảng tiền **Báo cáo tiền về** và **Báo cáo công nợ / dư nợ** trong **Kiểm tra bảng biểu**: dành cho Kế toán công ty.",
      "Màn hình của vị trí khác: giao việc, phê duyệt, nhân sự (Giám đốc); khách hàng, tài chính (Kế toán công ty); nhà cung cấp (Kế toán nhà máy); nội dung website (Biên tập nội dung).",
    ],
    workflows: [
      {
        title: "Bán sơn tại quầy và ghi công nợ",
        when: "Khi khách mua sơn tại quầy.",
        steps: [
          "Mở **Hóa đơn bán hàng** và bấm **+ Tạo phiếu bán hàng**.",
          "Chọn **Ngày** và nhập **Người nhận hàng**.",
          "Bấm **Thêm mặt hàng**, nhập **Mã vật tư**, **Số lượng** và kiểm tra **Giá**, rồi bấm **Áp dụng**.",
          "Lặp lại cho từng mặt hàng, hoặc bấm **Dán từ Excel** để dán nhiều dòng một lần.",
          "Bấm **Xác nhận**, đọc lại rồi bấm **Xác nhận phiếu**.",
          "Bấm **Xem bản in**, rồi bấm **In** để in phiếu cho khách.",
          "Mở **Công nợ bán sơn**, chọn tab **Phát sinh bán hàng** và bấm **Ghi phát sinh bán hàng**.",
          "Chọn **Khách hàng *** và **Ngày tháng ***, nhập **Mã hàng hóa ***, **Số lượng *** và **Đơn giá *** cho từng dòng.",
          "Bấm **Ghi sổ**.",
        ],
        result:
          "Phiếu bán hàng chuyển sang **Đã xác nhận**: người nhận, mặt hàng, số lượng và đơn giá được khóa. Công nợ của khách tăng ngay sau khi ghi sổ. Phiếu bán hàng không tự ghi vào công nợ, nên bạn phải ghi cả hai.",
        links: ["/sales-slips", "/receivables"],
      },
      {
        title: "Ghi nhận khách trả tiền mua sơn",
        when: "Khi khách mua sơn trả nợ, hoặc có khoản bù trừ làm giảm nợ.",
        steps: [
          "Mở **Công nợ bán sơn** và chọn tab **Thanh toán / Giảm nợ**.",
          "Bấm **Ghi nhận thanh toán / giảm nợ**.",
          "Chọn **Khách hàng *** và **Ngày tháng ***.",
          "Chọn **Loại giảm nợ *** (ví dụ thanh toán, bù trừ).",
          "Nhập **Số tiền ***, rồi nhập **Số chứng từ** và **Diễn giải** nếu có.",
          "Bấm **Ghi sổ**.",
          "Chọn tab **Tổng hợp công nợ** để kiểm tra cột **Dư hiện tại** của khách.",
        ],
        result:
          "Số dư tính lại ngay. Nếu bấm **Lưu nháp**, dòng được lưu nhưng chưa tính vào số dư.",
        links: ["/receivables"],
      },
      {
        title: "Nhập và xuất nguyên vật liệu",
        when: "Khi hàng về kho, hoặc khi giao vật tư cho cơ sở sản xuất.",
        steps: [
          "Mở **Nguyên vật liệu** và chọn tab **Nhập kho**.",
          "Bấm **Thêm phiếu nhập**, chọn **Ngày nhập**, nhập **Mã vật tư** và **Số lượng**, rồi bấm **Áp dụng**.",
          "Chọn tab **Xuất kho** khi giao hàng cho cơ sở.",
          "Bấm **Thêm phiếu xuất**, nhập **Cơ sở / người nhận**, **Mã vật tư** và **Số lượng xuất**, rồi bấm **Áp dụng**.",
          "Chọn tab **Tổng kho** để kiểm tra **Tồn cuối** và trạng thái của vật tư.",
        ],
        result:
          "Phiếu ghi vào kho ngay khi bấm **Áp dụng** và tồn kho tính lại. Nếu mã vật tư hoặc cơ sở chưa có, thêm ở tab **Danh mục NVL** trước.",
        links: ["/materials"],
      },
      {
        title: "Ghi một lần xuất sơn cho cơ sở sản xuất",
        when: "Khi giao sơn cho một cơ sở sản xuất.",
        steps: [
          "Mở **Bảng xuất kho sơn** và bấm **+ Thêm phiếu xuất**.",
          "Chọn **Ngày xuất** và nhập **Mã cơ sở SX**.",
          "Nhập **Mã vật tư** và **Số lượng**.",
          "Nhập **Số lượng thực nhận** và **Đơn giá đã chiết khấu** nếu khác mặc định.",
          "Bấm **Áp dụng**.",
          "Bấm **Xuất Excel** khi cần gửi bảng cho người khác.",
        ],
        result:
          "Dòng được ghi vào sổ ngay. Tên cơ sở, tên vật tư, ĐVT, đơn giá và thành tiền tự tính từ danh mục.",
        links: ["/paint-warehouse"],
      },
      {
        title: "Đưa đơn hàng qua phần kho",
        when: "Khi một đơn hàng đến bước **Kho cấp vật tư**, **Đóng gói & nhập thành phẩm** hoặc **Xuất hàng – Giao khách**.",
        steps: [
          "Mở **Sổ đơn hàng** và bấm vào mã đơn; đọc bảng **Hàng đặt** để biết mã hàng, số lượng và cơ sở làm.",
          "Kiểm tra tồn kho ở tab **Tổng kho** của **Nguyên vật liệu**.",
          "Ở bước 4: xuất kho như thường lệ, tải **Phiếu xuất kho** trong **Hồ sơ theo bước**, rồi bấm **Sản xuất** trong khung **Chuyển bước**; thiếu vật tư thì bấm **Đặt mua vật tư** và **Trình Giám đốc phê duyệt**.",
          "Ở bước 7: điền và **Lưu phiếu đóng gói**, tải **Ảnh đóng gói**, nhờ Quản lý nhà máy ghi **Kiểm đóng gói**, rồi bấm **Lập chứng từ xuất hàng**.",
          "Ở bước 10: giao hàng cho vận chuyển, tải **Biên bản giao hàng** nếu có, rồi bấm **Theo dõi công nợ & báo cáo**.",
        ],
        result:
          "Đơn sang bước mới và được ghi vào **Nhật ký chuyển bước**. Rời **Đặt mua vật tư** cần Giám đốc duyệt trước; rời bước 7 cần phiếu đóng gói và kiểm đóng gói đạt. Hệ thống không gửi thông báo khi Giám đốc đã quyết định.",
        links: ["/orders", "/materials"],
      },
      {
        title: "Nhận việc được giao và xin gia hạn",
        when: "Khi Giám đốc giao việc cho bạn.",
        steps: [
          "Mở **Công việc được giao** và chọn bộ lọc **Đang làm**.",
          "Đọc nội dung việc, hạn và **Người giao**.",
          "Bấm **Xong** khi đã làm xong.",
          "Nếu không kịp hạn, bấm **Xin gia hạn**, chọn **Hạn mới**, nhập **Lý do** rồi bấm **Gửi yêu cầu**.",
        ],
        result:
          "Yêu cầu gia hạn đến Giám đốc. Hạn chỉ đổi khi Giám đốc duyệt; câu trả lời hiện ngay trên thẻ việc.",
        links: ["/my-tasks"],
      },
    ],
    faq: [
      {
        question:
          "Tôi ghi nhầm một dòng ở **Bảng xuất kho sơn** thì sửa thế nào?",
        answer:
          "Bấm **Sửa** ở dòng đó, chỉnh lại rồi bấm **Áp dụng**. Nếu dòng ghi thừa, bấm **Xóa dòng** và bấm **Xóa dòng** lần nữa trong khung xác nhận.",
      },
      {
        question: "Phiếu nhập hoặc xuất nguyên vật liệu sai thì làm sao?",
        answer:
          "Bấm **Sửa** để chỉnh, hoặc bấm **Hủy dòng**, nhập **Lý do hủy (bắt buộc)** rồi bấm **Hủy dòng này**. Phiếu đã hủy vẫn nằm trong sổ, có dấu đã hủy, và tồn kho tính lại. Bật **Hiện dòng đã hủy** để xem lại.",
      },
      {
        question: "Xuất kho báo “Số lượng xuất vượt quá tồn kho hiện tại”?",
        answer:
          "Số lượng xuất lớn hơn tồn kho đang có. Kiểm tra xem phiếu nhập của lô hàng đó đã được ghi chưa, rồi ghi phiếu nhập trước.",
      },
      {
        question: "Phiếu bán hàng đã xác nhận mà cần sửa?",
        answer:
          "Mở phiếu, bấm **Mở lại để sửa**, nhập **Lý do mở lại (bắt buộc)** rồi bấm **Mở lại phiếu**. Phiếu quay về **Nháp** để sửa. Nếu phiếu không còn dùng, bấm **Hủy phiếu**, nhập **Lý do hủy (bắt buộc)** rồi bấm **Hủy phiếu này**: phiếu vẫn được lưu, bản in đóng dấu ĐÃ HỦY, và không thể xóa hẳn.",
      },
      {
        question: "Ghi phiếu bán hàng rồi thì công nợ có tự tăng không?",
        answer:
          "Không. Phiếu bán hàng và công nợ bán sơn ghi riêng. Sau khi xác nhận phiếu, bạn ghi thêm ở **Công nợ bán sơn** bằng nút **Ghi phát sinh bán hàng**. Hai màn hình dùng chung danh mục mã sơn.",
      },
      {
        question: "Vì sao tôi không thấy giá bán của đơn hàng?",
        answer:
          "Giá bán của đơn hàng chỉ Giám đốc và Kế toán công ty được xem, nên **Sổ đơn hàng** không có cột giá bán và trang đơn ghi “Bạn không có quyền xem giá bán của đơn này.” Bạn vẫn thấy mọi thông tin khác của đơn để làm phần việc kho.",
      },
      {
        question: "Tôi muốn sửa dư đầu kỳ của một khách mua sơn?",
        answer:
          "Nhờ Kế toán công ty. Bạn sửa được từng dòng đã ghi bằng nút **Sửa**, kèm lý do sửa, nhưng dư đầu kỳ chỉ Kế toán công ty và Giám đốc sửa.",
      },
      {
        question: "Tôi bấm **Tạo đơn hàng** nhưng không có ô nào để nhập?",
        answer:
          "Tạo đơn hàng là việc của Kế toán công ty, nên màn hình chỉ hiện một khung màu vàng thay cho biểu mẫu. Bạn không cần làm theo câu trong khung đó; bạn làm việc với đơn sau khi đơn đến phần kho.",
      },
    ],
  },

  FACTORY_MANAGER: {
    key: "FACTORY_MANAGER",
    intro: [
      "Quản lý nhà máy tổ chức sản xuất: nhận đơn hàng từ khách, lập kế hoạch, điều phối các cơ sở, theo dõi chất lượng. Các cơ sở không đăng nhập hệ thống, nên bạn là người ghi công đoạn và kết quả kiểm thay họ.",
      "Trong quy trình mười một bước của một đơn hàng, bạn phụ trách bước 1 (ghi đơn và trình Giám đốc xác nhận), bước 2 (xác nhận mẫu & kỹ thuật), bước 3 (lập kế hoạch sản xuất), bước 5 (sản xuất qua Mộc, Sơn, Hoàn thiện) và bước 6 (kiểm tra chất lượng). Bạn cũng ghi ba lần kiểm: kiểm mộc, kiểm hoàn thiện và kiểm đóng gói.",
      "Sau khi bạn lưu kế hoạch, Thủ kho cấp vật tư. Trong lúc sản xuất, Kế toán nhà máy ghi chi phí cho đơn và bạn theo dõi được tổng chi. Khi kiểm hoàn thiện đạt, đơn sang Thủ kho đóng gói; kiểm đóng gói đạt thì đơn sang Kế toán nhà máy lập chứng từ.",
    ],
    responsibilities: [
      "Ghi đơn hàng mới với hàng đặt, shipping mark và ngày giao cam kết, rồi trình Giám đốc xác nhận trong **Sổ đơn hàng**.",
      "Xác nhận mẫu & kỹ thuật và lưu kế hoạch sản xuất theo công đoạn.",
      "Chuyển công đoạn Mộc → Sơn → Hoàn thiện và chuyển đơn sang kiểm tra chất lượng, đóng gói.",
      "Ghi kiểm mộc, kiểm hoàn thiện, kiểm đóng gói; trả đơn về sản xuất kèm lý do khi không đạt.",
      "Theo dõi chi phí thực tế của từng đơn ở **Chi phí đơn hàng**.",
      "Tra cứu bước nào thuộc vị trí nào ở **Quy trình đơn hàng**.",
      "Xem kết quả đối chiếu bảng biểu đơn hàng ở **Kiểm tra bảng biểu**.",
      "Làm việc được Giám đốc giao ở **Công việc được giao**.",
    ],
    sees: [
      "Danh sách đơn hàng, hàng đặt, bước hiện tại, tiến trình mười một bước, các lần kiểm, tỷ lệ lỗi và nhật ký chuyển bước.",
      "Trạng thái phê duyệt của Giám đốc ở từng bước cần duyệt.",
      "Tổng chi phí đã ghi cho từng đơn và danh sách phiếu chi: ngày, hạng mục, đơn hàng, đối tác, số tiền, hình thức.",
    ],
    hidden: [
      "Giá bán của đơn hàng: **Sổ đơn hàng** không có cột giá bán, và khung **Giá bán** trên trang đơn ghi “Bạn không có quyền xem giá bán của đơn này.” Chỉ Giám đốc, Kế toán công ty và Kế toán nhà máy xem giá bán.",
      "Hóa đơn (INV), tiền khách trả và công nợ khách hàng: do hai vị trí kế toán giữ.",
      "Lợi nhuận của đơn: chỉ Giám đốc. Lương: Giám đốc và Kế toán công ty.",
      "Khung ghi phiếu chi ở **Chi phí đơn hàng**: Kế toán nhà máy ghi chi phí; phiếu ghi sai do Kế toán công ty hủy.",
      "Nút **Tải bảng mới** ở **Kiểm tra bảng biểu**: Kế toán nhà máy, Kế toán công ty và Thủ kho tải bảng lên.",
      "Màn hình của vị trí khác: kho sơn, nguyên vật liệu, phiếu bán hàng (Thủ kho); nhà cung cấp (Kế toán nhà máy); tài chính, khách hàng (Kế toán công ty); giao việc, phê duyệt (Giám đốc).",
    ],
    workflows: [
      {
        title: "Ghi đơn mới, xác nhận mẫu và lập kế hoạch (bước 1 → 3)",
        when: "Khi khách đặt hàng, và sau khi Giám đốc đã xác nhận đơn.",
        steps: [
          "Mở **Sổ đơn hàng**, bấm **Tạo đơn hàng**, chọn khách, nhập từng mã hàng vào bảng **Hàng đặt**, nhập **Shipping mark** và **Ngày giao cam kết**, rồi bấm **Ghi nhận đơn hàng**.",
          "Bấm **Giám đốc xác nhận đơn hàng** trong khung **Chuyển bước**, rồi **Trình Giám đốc phê duyệt**.",
          "Sau khi Giám đốc chuyển đơn sang bước 2, chốt mẫu với Thiết kế, tải **Hồ sơ kỹ thuật mẫu** và bấm **Lập kế hoạch sản xuất**.",
          "Ở bước 3, điền các ngày và phân công trong phần **Kế hoạch sản xuất (bước 3)**, bấm **Lưu kế hoạch**, rồi bấm **Kho cấp vật tư**.",
        ],
        result:
          "Đơn sang bước 4 và đến lượt Thủ kho. Kế hoạch không cần Giám đốc duyệt; chưa lưu kế hoạch thì không rời được bước 3.",
        links: ["/orders", "/operations"],
      },
      {
        title: "Một đơn hàng đi qua xưởng (bước 5 → 7)",
        when: "Khi Thủ kho đã cấp vật tư và đơn ở bước **Sản xuất**.",
        steps: [
          "Mở **Sổ đơn hàng** và bấm vào mã đơn.",
          "Mộc xong, bấm **Ghi kiểm mộc** với **Đạt** và **Ghi kết quả**; rồi bấm **Chuyển sang: Sơn**, sơn xong bấm **Chuyển sang: Hoàn thiện**.",
          "Hoàn thiện xong, bấm **Kiểm tra chất lượng (QC)** trong khung **Chuyển bước**.",
          "Kiểm thành phẩm rồi bấm **Ghi kiểm hoàn thiện**: **Đạt** kèm **Số sản phẩm lỗi**, hoặc **Không đạt**.",
          "Đạt thì bấm **Đóng gói & nhập thành phẩm**; không đạt thì nhập **Lý do (bắt buộc)** rồi bấm **Sản xuất** để trả về.",
          "Khi Thủ kho đã lưu phiếu đóng gói, kiểm hàng đã đóng và bấm **Ghi kiểm đóng gói** với **Đạt**.",
        ],
        result:
          "Kiểm đóng gói đạt thì Thủ kho chuyển đơn sang bước 8. Trả về sản xuất thì lý do được ghi vào **Nhật ký chuyển bước**, và đơn phải qua kiểm hoàn thiện lại.",
        links: ["/orders"],
      },
      {
        title: "Theo dõi chi phí của một đơn đang sản xuất",
        when: "Khi muốn biết một đơn đã tốn bao nhiêu.",
        steps: [
          "Mở **Sổ đơn hàng** và bấm vào mã đơn.",
          "Đọc tổng tiền trong khung **Chi phí đã ghi**.",
          "Bấm **Ghi / xem phiếu chi →** để mở **Chi phí đơn hàng**.",
          "Kiểm tra từng phiếu chi: hạng mục, đơn hàng, đối tác, số tiền.",
          "Báo Kế toán nhà máy nếu thiếu khoản chi, hoặc báo Kế toán công ty nếu có phiếu ghi sai.",
        ],
        result:
          "Bạn nắm được chi phí thực tế của đơn. Tổng chỉ cộng các phiếu còn hiệu lực; phiếu đã hủy không tính.",
        links: ["/orders", "/finance/expenses"],
      },
      {
        title: "Nhận việc được giao và xin gia hạn",
        when: "Khi Giám đốc giao việc cho bạn.",
        steps: [
          "Mở **Công việc được giao** và chọn bộ lọc **Đang làm**.",
          "Bấm vào mã đơn trên thẻ việc nếu việc gắn với một đơn hàng.",
          "Bấm **Xong** khi đã làm xong.",
          "Nếu không kịp hạn, bấm **Xin gia hạn**, chọn **Hạn mới**, nhập **Lý do** rồi bấm **Gửi yêu cầu**.",
        ],
        result:
          "Yêu cầu gia hạn đến Giám đốc. Hạn chỉ đổi khi Giám đốc duyệt; câu trả lời hiện trên thẻ việc.",
        links: ["/my-tasks", "/orders"],
      },
      {
        title: "Hỏi nhanh tình hình các đơn đang mở",
        when: "Đầu ngày, hoặc trước khi họp sản xuất.",
        steps: [
          "Mở **Trợ lý AI**.",
          "Bấm gợi ý “Tóm tắt tiến độ các đơn hàng đang mở.”; câu hỏi được gửi đi ngay.",
          "Nhập câu hỏi khác nếu cần, rồi bấm **Gửi**.",
          "Đọc câu trả lời và mục **Nguồn**.",
          "Mở **Sổ đơn hàng** để làm thao tác trên từng đơn.",
        ],
        result:
          "Trợ lý chỉ đọc dữ liệu bạn được xem và không tự thay đổi gì. Mọi thao tác trên đơn vẫn làm ở **Sổ đơn hàng**.",
        links: ["/assistant", "/orders"],
      },
    ],
    faq: [
      {
        question:
          "Bấm **Đóng gói** thì báo “Chưa đạt kiểm tra chất lượng thì không được đóng gói.”?",
        answer:
          "Bạn cần bấm **Ghi nhận QC đạt** trong khung **Kiểm soát chất lượng** trước, rồi mới chuyển sang **Đóng gói**.",
      },
      {
        question:
          "Khung **Chuyển bước** chỉ hiện một dòng chữ màu vàng, không có nút?",
        answer:
          "Bước hiện tại thuộc vị trí khác, ví dụ Thủ kho hoặc Kế toán công ty. Bạn chờ họ chuyển đơn đến bước của bạn.",
      },
      {
        question: "Tôi đã trình Giám đốc nhưng vẫn chưa chuyển bước được?",
        answer:
          "Khung **Phê duyệt của Giám đốc** báo “Đang chờ Giám đốc quyết định.” thì bạn chờ. Nếu báo “Đã có phê duyệt nhưng đơn hàng đã thay đổi sau đó — phải trình duyệt lại.”, bấm **Trình Giám đốc phê duyệt** lần nữa.",
      },
      {
        question: "Vì sao tôi không ghi được phiếu chi ở **Chi phí đơn hàng**?",
        answer:
          "Ghi chi phí là việc của Kế toán nhà máy. Bạn xem được mọi phiếu và tổng chi của từng đơn. Gửi chứng từ cho Kế toán nhà máy để họ ghi.",
      },
      {
        question: "Vì sao tôi không thấy giá bán của đơn?",
        answer:
          "Giá bán, hóa đơn và tiền khách trả chỉ Giám đốc và Kế toán công ty được xem. Bạn vẫn thấy tiến độ và chi phí của đơn.",
      },
      {
        question:
          "**Quy trình đơn hàng** và **Sổ đơn hàng** khác nhau thế nào?",
        answer:
          "**Quy trình đơn hàng** là bảng tra cứu mười một bước: bước nào do vị trí nào phụ trách, bước nào Giám đốc phải duyệt và bước nào cần đầu ra gì. Mọi thao tác thật trên đơn làm ở **Sổ đơn hàng**.",
      },
      {
        question:
          "Tôi không thấy nút **Tải bảng mới** ở **Kiểm tra bảng biểu**?",
        answer:
          "Vai trò của bạn chỉ xem kết quả kiểm tra. Nhờ Kế toán nhà máy hoặc Kế toán công ty tải bảng lên.",
      },
    ],
  },

  FACTORY_ACCOUNTANT: {
    key: "FACTORY_ACCOUNTANT",
    intro: [
      "Kế toán nhà máy & mua hàng kiểm soát chi phí của nhà máy và các cơ sở, làm việc với nhà cung cấp, và lập bộ chứng từ xuất hàng: Invoice (INV), Packing List (PKL) và tem nhãn. Bạn giữ danh sách nhà cung cấp và ghi từng khoản chi thực tế cho từng đơn hàng.",
      "Trong quy trình mười một bước, bạn phụ trách bước 8 (lập chứng từ xuất hàng): INV và PKL phải có 3 tuần trước ngày đóng hàng, và có hai chứng từ đó mới rời được bước 8. Chi phí bạn ghi chạy song song với sản xuất; phiếu sai do Kế toán công ty hủy.",
      "Theo quyết định của Giám đốc, bạn xem được giá bán và lập hóa đơn, nhưng không xem tiền khách đã trả, tiền cọc và công nợ khách hàng. Kế toán công ty giữ phần đó.",
    ],
    responsibilities: [
      "Thêm và cập nhật hồ sơ nhà cung cấp ở **Nhà cung cấp**.",
      "Ghi từng khoản chi thực tế theo đơn hàng ở **Chi phí đơn hàng**.",
      "Theo dõi tổng chi của từng đơn và từng nhà cung cấp.",
      "Lập hóa đơn ở **Hóa đơn (INV)** hoặc ngay trên trang đơn, và tải INV, PKL, tem nhãn vào **Bộ chứng từ xuất khẩu** của đơn trong **Sổ đơn hàng**.",
      "Chuyển đơn từ bước 8 sang **Thủ tục xuất nhập khẩu** khi INV và PKL đã có.",
      "Theo dõi tiến độ các đơn đang sản xuất ở **Sổ đơn hàng**.",
      "Tải danh sách đơn hàng từ Excel lên để đối chiếu ở **Kiểm tra bảng biểu**.",
      "Làm việc được Giám đốc giao ở **Công việc được giao**.",
    ],
    sees: [
      "Mọi phiếu chi theo đơn hàng: ngày, hạng mục, đơn hàng, đối tác, số tiền, hình thức.",
      "Tổng chi của từng đơn và tổng chi đã ghi cho từng nhà cung cấp.",
      "Hồ sơ nhà cung cấp: mã, tên, mã số thuế, người liên hệ, điện thoại, địa chỉ.",
      "Danh sách đơn hàng, hàng đặt, shipping mark, giá bán, bước hiện tại, tiến trình và nhật ký chuyển bước.",
      "Hóa đơn của từng đơn: số, ngày lập, hạn, giá trị, tỷ giá và file INV.",
    ],
    hidden: [
      "Tiền khách đã trả, tiền cọc, công nợ khách hàng và chứng từ thanh toán: bảng hóa đơn của bạn không có cột **Còn thiếu**, và thẻ **Tiền của đơn** không hiện trên trang đơn. Kế toán công ty và Giám đốc giữ phần này.",
      "Lợi nhuận của đơn: chỉ Giám đốc.",
      "Nút **Hủy phiếu** ở **Chi phí đơn hàng**: phiếu chi ghi sai do Kế toán công ty hủy.",
      "Nút **Lưu trữ nhà cung cấp**: Giám đốc lưu trữ hoặc khôi phục nhà cung cấp.",
      "Các bảng tiền **Báo cáo tiền về** và **Báo cáo công nợ / dư nợ** trong **Kiểm tra bảng biểu**: dành cho Kế toán công ty.",
      "Màn hình của vị trí khác: kho sơn, nguyên vật liệu, bán sơn (Thủ kho); tài chính, khách hàng (Kế toán công ty); giao việc, phê duyệt (Giám đốc).",
    ],
    workflows: [
      {
        title: "Ghi chi phí cho một đơn đang sản xuất",
        when: "Khi có chứng từ chi cho một đơn hàng: mua vật tư, trả công, gia công, vận chuyển, đóng gói.",
        steps: [
          "Mở **Nhà cung cấp** và kiểm tra nhà cung cấp đã có trong danh sách chưa.",
          "Nhập thông tin vào khung **Thêm nhà cung cấp** và bấm **Thêm nhà cung cấp** nếu chưa có.",
          "Mở **Chi phí đơn hàng** và tìm khung **Ghi phiếu chi theo đơn**.",
          "Chọn **Đơn hàng** và **Hạng mục**.",
          "Chọn **Nhà cung cấp**, hoặc chọn “— Không có trong danh sách —” rồi nhập **Đối tác / diễn giải**.",
          "Nhập **Số tiền**, chọn **Tiền tệ**, **Hình thức** và **Ngày**.",
          "Bấm **Ghi phiếu**.",
        ],
        result:
          "Thông báo “Đã ghi phiếu.” hiện lên. Phiếu cộng vào **Tổng đã chi (phiếu còn hiệu lực)**, vào khung **Chi phí đã ghi** trên trang đơn hàng, và vào trang của nhà cung cấp đó. Quản lý nhà máy và Kế toán công ty thấy ngay.",
        links: ["/suppliers", "/finance/expenses", "/orders"],
      },
      {
        title: "Cập nhật hồ sơ một nhà cung cấp",
        when: "Khi nhà cung cấp đổi người liên hệ, điện thoại, địa chỉ hoặc mã số thuế.",
        steps: [
          "Mở **Nhà cung cấp**.",
          "Bấm vào tên nhà cung cấp cần sửa.",
          "Sửa các ô trong khung thông tin.",
          "Bấm **Lưu thay đổi**.",
          "Xem khung **Chi phí đã ghi cho nhà cung cấp này** để kiểm tra các khoản đã chi.",
        ],
        result:
          "Thông báo “Đã lưu.” hiện lên. Tên mới hiện ngay trong ô chọn **Nhà cung cấp** khi ghi phiếu chi.",
        links: ["/suppliers"],
      },
      {
        title: "Lập INV, PKL và tem nhãn cho một đơn xuất khẩu",
        when: "Ngay khi Kế toán công ty đã nhập số booking, chậm nhất 3 tuần trước ngày đóng hàng.",
        steps: [
          "Mở **Sổ đơn hàng** và bấm vào mã đơn; đọc **Hàng đặt**, **Shipping mark** và **Giá bán**.",
          "Lập hóa đơn trong khung **Lập hóa đơn cho đơn này** của thẻ **Hóa đơn (INV)**, rồi tải file INV lên trang hóa đơn.",
          "Trong bảng **Bộ chứng từ xuất khẩu** của đơn, bấm **Tải lên** ở dòng **Invoice (INV)**, **Packing List (PKL)** và **Tem nhãn**.",
          "Khi đơn tới bước 8 · Lập chứng từ xuất hàng, bấm **Thủ tục xuất nhập khẩu** trong khung **Chuyển bước**.",
        ],
        result:
          "Đơn sang bước 9 và đến lượt Kế toán công ty làm tờ khai. Cột **Hạn** của bảng chứng từ báo **Quá hạn** nếu INV hoặc PKL chưa có sau hạn.",
        links: ["/orders", "/finance/invoices"],
      },
      {
        title: "Đối chiếu danh sách đơn hàng từ file Excel",
        when: "Khi có một bảng Excel liệt kê đơn hàng cần so với dữ liệu trong hệ thống.",
        steps: [
          "Mở **Kiểm tra bảng biểu** và bấm **Tải bảng mới**.",
          "Chọn **Loại bảng** là **Danh sách đơn hàng**.",
          "Chọn tệp ở ô **Tệp (.xlsx, .xls, .csv)** và bấm **Đọc bảng**.",
          "Kiểm tra bảng **Xác nhận cột** và sửa ô **Ý nghĩa** nếu hệ thống đoán sai.",
          "Bấm **Chạy kiểm tra**.",
          "Đọc kết quả từng dòng: **Khớp**, **Lệch**, **Không thấy**.",
          "Mở đơn trong **Sổ đơn hàng** để xem kỹ những dòng **Lệch** hoặc **Không thấy**.",
        ],
        result:
          "Kết quả chỉ để xem: không sửa gì trong hệ thống và không lưu tệp gốc. Bấm **Xuất CSV** nếu cần gửi kết quả.",
        links: ["/checks", "/orders"],
      },
      {
        title: "Nhận việc được giao và xin gia hạn",
        when: "Khi Giám đốc giao việc cho bạn.",
        steps: [
          "Mở **Công việc được giao** và chọn bộ lọc **Đang làm**.",
          "Đọc nội dung việc, hạn và **Người giao**.",
          "Bấm **Xong** khi đã làm xong.",
          "Nếu không kịp hạn, bấm **Xin gia hạn**, chọn **Hạn mới**, nhập **Lý do** rồi bấm **Gửi yêu cầu**.",
        ],
        result:
          "Yêu cầu gia hạn đến Giám đốc. Hạn chỉ đổi khi Giám đốc duyệt; câu trả lời hiện trên thẻ việc.",
        links: ["/my-tasks"],
      },
    ],
    faq: [
      {
        question: "Tôi ghi nhầm một phiếu chi thì sửa thế nào?",
        answer:
          "Phiếu chi không sửa trực tiếp được. Báo Kế toán công ty hủy phiếu đó kèm lý do, rồi bạn ghi lại phiếu đúng. Phiếu đã hủy vẫn nằm trong sổ nhưng không tính vào tổng.",
      },
      {
        question: "Nhà cung cấp không có trong ô chọn khi ghi phiếu chi?",
        answer:
          "Thêm nhà cung cấp ở **Nhà cung cấp** rồi quay lại ghi phiếu. Nếu là khoản chi lẻ, chọn “— Không có trong danh sách —” và nhập **Đối tác / diễn giải**.",
      },
      {
        question: "Thêm nhà cung cấp báo “Mã nhà cung cấp này đã tồn tại.”?",
        answer:
          "Mã đó đã dùng cho một nhà cung cấp khác. Tìm nhà cung cấp đó trong danh sách, hoặc đặt mã khác.",
      },
      {
        question: "Tôi không thấy nút lưu trữ nhà cung cấp?",
        answer:
          "Lưu trữ và khôi phục nhà cung cấp do Giám đốc làm. Bạn thêm mới và sửa thông tin được.",
      },
      {
        question:
          "Vì sao tôi thấy giá bán và hóa đơn nhưng không thấy tiền khách trả?",
        answer:
          "Giám đốc đã quyết định: Kế toán nhà máy lập INV nên cần giá bán, nhưng tiền khách đã trả, tiền cọc và công nợ khách hàng do Kế toán công ty giữ.",
      },
      {
        question: "Vì sao ô chọn **Đơn hàng** không có một số đơn?",
        answer:
          "Đơn đã hủy không hiện trong ô chọn, vì không ghi chi phí mới cho đơn đã hủy.",
      },
      {
        question:
          "**Loại bảng** ở **Kiểm tra bảng biểu** chỉ có **Danh sách đơn hàng**?",
        answer:
          "Hai loại bảng tiền **Báo cáo tiền về** và **Báo cáo công nợ / dư nợ** đọc tiền của khách, nên chỉ Kế toán công ty dùng.",
      },
    ],
  },

  COMPANY_ACCOUNTANT: {
    key: "COMPANY_ACCOUNTANT",
    intro: [
      "Kế toán công ty giữ sổ sách và tài chính của công ty: hóa đơn, tiền khách trả, công nợ, thu – chi, tỷ giá USD. Bạn cũng giữ danh sách khách hàng, làm thủ tục xuất nhập khẩu và bộ chứng từ sau khi hàng đi.",
      "Bạn xem được giá bán và toàn bộ tiền của khách. Trong quy trình mười một bước, bạn có thể ghi đơn thay Quản lý nhà máy (bước 1), làm tờ khai hải quan (bước 9), theo dõi công nợ (bước 11) và tải B/L, hun trùng, Phyto, C/O trong 7 ngày sau khi hàng đi.",
      "Công việc của bạn nối với nhiều vị trí: Giám đốc xác nhận đơn sau khi trình; Kế toán nhà máy lập INV, PKL và ghi chi phí, bạn là người hủy phiếu chi ghi sai; Thủ kho xuất hàng xong thì đơn về bạn ở bước 11. Bạn cũng đối chiếu công nợ bán sơn tại quầy với Thủ kho, và xử lý đơn khách đặt trên cửa hàng online.",
    ],
    responsibilities: [
      "Thêm và cập nhật khách hàng ở **Khách hàng**.",
      "Ghi đơn hàng khi cần, nhập giá bán và trình Giám đốc xác nhận ở **Sổ đơn hàng**.",
      "Cập nhật tiến độ xuất hàng (số booking, ngày booking), tải tờ khai hải quan và bộ chứng từ sau khi hàng đi, tải chứng từ thanh toán lên trang đơn hàng.",
      "Lập và hủy hóa đơn ở **Hóa đơn (INV)**.",
      "Ghi tiền khách trả và phân bổ vào hóa đơn, đơn hàng ở **Tiền khách trả**.",
      "Theo dõi khách còn nợ ở **Công nợ khách hàng** và toàn cảnh ở **Tổng quan tài chính**.",
      "Ghi các khoản thu khác ở **Thu – Chi**; hủy phiếu thu và phiếu chi ghi sai kèm lý do.",
      "Nhập tỷ giá USD theo ngày ở **Tỷ giá USD**.",
      "Theo dõi phiếu bán sơn và công nợ bán sơn, sửa dư đầu kỳ khi cần.",
      "Xác nhận, hoàn thành hoặc hủy đơn khách đặt trên website ở **Đơn cửa hàng**.",
    ],
    sees: [
      "Giá bán của đơn hàng, hóa đơn, tiền khách trả, tiền cọc, công nợ và tiền khách trả dư.",
      "Thu, chi và chi phí đã ghi cho từng đơn hàng.",
      "Hồ sơ khách hàng đầy đủ, kể cả mã số thuế và ghi chú.",
      "Phiếu bán sơn kèm giá, công nợ bán sơn và dư đầu kỳ.",
      "Đơn khách đặt trên cửa hàng online, kèm thông tin liên hệ.",
      "Trạng thái cấu hình các dịch vụ ở **Thiết lập** (chỉ xem).",
    ],
    hidden: [
      "**Giao việc**, **Phê duyệt**, **Danh sách nhân sự** và **Yêu cầu báo giá** từ website: là màn hình riêng của Giám đốc.",
      "Bảng xuất kho sơn và sổ nguyên vật liệu: Thủ kho giữ.",
      "Danh sách nhà cung cấp và việc ghi phiếu chi theo đơn: Kế toán nhà máy làm; bạn đọc và hủy phiếu.",
      "Nội dung website, sản phẩm và mặt hàng cửa hàng: Biên tập nội dung làm.",
      "Nút **Lưu trữ khách hàng**: Giám đốc lưu trữ hoặc khôi phục khách hàng.",
      "Thay đổi cấu hình hệ thống, ví dụ kết nối Zalo: Giám đốc làm; **Thiết lập** của bạn chỉ để xem.",
      "Chuyển bước sản xuất, chuyển công đoạn và ghi kết quả kiểm: Quản lý nhà máy. Xác nhận đơn và đóng hồ sơ: Giám đốc.",
      "Lợi nhuận của từng đơn: chỉ Giám đốc xem.",
    ],
    workflows: [
      {
        title: "Ghi đơn mới, nhập giá bán và trình Giám đốc xác nhận",
        when: "Khi khách đặt một đơn hàng và Quản lý nhà máy chưa ghi.",
        steps: [
          "Mở **Khách hàng**, kiểm tra khách đã có chưa; nếu chưa, nhập khung **Thêm khách hàng** rồi bấm **Thêm khách hàng**.",
          "Mở **Sổ đơn hàng** và bấm **Tạo đơn hàng**.",
          "Chọn **Khách hàng** và **Đơn vị kinh doanh thực hiện**; nhập từng mã hàng vào bảng **Hàng đặt**, **Shipping mark** và **Ngày giao cam kết**.",
          "Nhập **Giá bán (tùy chọn)**, chọn **Tiền tệ**, nhập **Ghi chú** nếu cần.",
          "Bấm **Ghi nhận đơn hàng**.",
          "Với đơn do Quản lý nhà máy ghi, mở đơn và nhập giá trong khung **Cập nhật giá bán (trước khi Giám đốc xác nhận)**.",
          "Bấm **Giám đốc xác nhận đơn hàng** trong khung **Chuyển bước**, rồi **Trình Giám đốc phê duyệt** trong khung **Phê duyệt của Giám đốc**.",
        ],
        result:
          "Đơn chờ Giám đốc quyết định. Sau khi Giám đốc duyệt và chuyển bước, đơn đến lượt Quản lý nhà máy xác nhận mẫu. Giá bán chỉ sửa được khi đơn còn ở bước 1.",
        links: ["/customers", "/orders"],
      },
      {
        title: "Lập hóa đơn và ghi tiền khách trả",
        when: "Khi xuất hóa đơn cho khách và khi khách chuyển tiền.",
        steps: [
          "Mở **Tỷ giá USD** và kiểm tra đã có tỷ giá cho ngày lập hóa đơn chưa; nếu chưa, nhập rồi bấm **Lưu tỷ giá**.",
          "Mở **Hóa đơn (INV)** và tìm khung **Lập hóa đơn**.",
          "Chọn **Đơn hàng**, nhập **Số hóa đơn (INV)**, **Ngày lập**, **Hạn thanh toán** và **Giá trị hóa đơn**.",
          "Bấm **Lập hóa đơn**.",
          "Mở **Tiền khách trả** khi khách chuyển tiền, và tìm khung **Ghi phiếu thu của khách**.",
          "Chọn **Gắn vào** là hóa đơn hoặc đơn hàng; khách chuyển gộp thì để trống và chọn **Khách hàng**.",
          "Nhập **Số tiền**, chọn **Tiền tệ**, **Hình thức**, **Ngày**, rồi bấm **Ghi phiếu**.",
          "Bấm chữ **Chưa phân bổ** ở cột **Phân bổ** của phiếu chuyển gộp, nhập số tiền cho từng dòng ở cột **Phiếu này** rồi bấm **Lưu phân bổ**.",
          "Mở **Công nợ khách hàng** để kiểm tra cột **Còn thiếu**.",
        ],
        result:
          "Doanh thu ghi theo hóa đơn. Hóa đơn USD giữ tỷ giá của ngày lập. Phần tiền chưa phân bổ là tiền khách trả trước và tự bù cho hóa đơn sau. Hóa đơn quá hạn mà còn thiếu được đánh dấu đỏ.",
        links: [
          "/finance/fx",
          "/finance/invoices",
          "/finance/payments",
          "/finance/receivables",
        ],
      },
      {
        title: "Tờ khai hải quan và bộ chứng từ sau khi hàng đi",
        when: "Khi có số booking; khi đơn ở bước **Thủ tục xuất nhập khẩu**; và trong 7 ngày sau khi hàng đi.",
        steps: [
          "Mở **Sổ đơn hàng** và bấm vào mã đơn.",
          "Nhập **Ngày dự kiến sẵn hàng**, **Số booking** và **Ngày booking / đóng hàng** trong khung **Tiến độ xuất hàng**, bấm **Lưu tiến độ**. Hạn của INV, PKL và tờ khai tính từ ngày booking này.",
          "Ở bước 9, bấm **Tải lên** ở dòng **Tờ khai hải quan** trong bảng **Bộ chứng từ xuất khẩu**, rồi bấm **Xuất hàng – Giao khách** trong khung **Chuyển bước**.",
          "Sau khi Thủ kho chuyển đơn sang bước 11, tải **Bill of Lading (B/L)**, **Chứng thư hun trùng**, **Kiểm dịch thực vật (Phyto)** và **C/O (xuất xứ)** trước hạn ở cột **Hạn**.",
          "Bấm **Tải chứng từ lên** trong khung **Chứng từ thanh toán** nếu có ủy nhiệm chi, giấy báo có hoặc L/C.",
        ],
        result:
          "Không cần Giám đốc duyệt xuất hàng. Khi khách trả đủ, bấm **Đã thu đủ – Giám đốc đóng hồ sơ**; Giám đốc đọc lợi nhuận và đóng hồ sơ.",
        links: ["/orders"],
      },
      {
        title: "Đối chiếu công nợ bán sơn và sửa dư đầu kỳ",
        when: "Cuối kỳ, hoặc khi số dư của một khách mua sơn không khớp.",
        steps: [
          "Mở **Công nợ bán sơn** và chọn tab **Tổng hợp công nợ**.",
          "Tìm khách ở ô **Tìm khách hàng**.",
          "Bấm vào khách để mở sổ chi tiết.",
          "Đối chiếu từng dòng với **Hóa đơn bán hàng** của Thủ kho.",
          "Bấm **Sửa dư đầu kỳ**, nhập **Lý do điều chỉnh (bắt buộc)** rồi bấm **Lưu dư đầu kỳ** nếu dư đầu kỳ sai.",
          "Bấm **Xuất sổ công nợ** nếu cần gửi cho khách.",
        ],
        result:
          "Số dư tính lại ngay. Mọi thay đổi được ghi ở tab **Nhật ký** kèm người sửa.",
        links: ["/receivables", "/sales-slips"],
      },
      {
        title: "Xử lý đơn khách đặt trên cửa hàng online",
        when: "Khi có đơn mới trên website.",
        steps: [
          "Mở **Đơn cửa hàng** và bấm bộ lọc **Mới**.",
          "Bấm **Mở** ở đơn cần xử lý.",
          "Liên hệ khách để thống nhất phí vận chuyển.",
          "Bấm **Xác nhận đơn**.",
          "Bấm **Hoàn thành** khi khách đã nhận hàng.",
          "Nếu khách không mua nữa, nhập **Lý do (tuỳ chọn)**, bấm **Huỷ đơn** rồi bấm **Huỷ hẳn? Bấm lần nữa**.",
        ],
        result:
          "Tồn kho của mặt hàng bị trừ khi bạn xác nhận, và được cộng lại nếu đơn đã xác nhận bị huỷ.",
        links: ["/shop/orders"],
      },
      {
        title: "Hủy một phiếu chi ghi sai",
        when: "Khi Kế toán nhà máy báo ghi nhầm một phiếu chi.",
        steps: [
          "Mở **Chi phí đơn hàng**.",
          "Tìm phiếu sai trong bảng.",
          "Nhập lý do vào ô **Lý do hủy…** ở dòng đó.",
          "Bấm **Hủy phiếu**.",
          "Báo Kế toán nhà máy ghi lại phiếu đúng.",
        ],
        result:
          "Phiếu chuyển sang **Đã hủy**, vẫn nằm trong sổ nhưng không tính vào tổng chi phí của đơn.",
        links: ["/finance/expenses"],
      },
    ],
    faq: [
      {
        question: "Hóa đơn lập sai thì làm sao?",
        answer:
          "Nhập **Lý do hủy…** ở dòng hóa đơn đó, bấm **Hủy**, rồi lập lại. Số hóa đơn đã hủy được dùng lại.",
      },
      {
        question: "Khách chuyển một lần cho nhiều đơn?",
        answer:
          "Ghi phiếu thu với **Gắn vào** để trống và chọn **Khách hàng**. Sau đó bấm chữ **Chưa phân bổ** ở cột **Phân bổ** của phiếu, nhập số tiền cho từng hóa đơn hoặc đơn, rồi bấm **Lưu phân bổ**.",
      },
      {
        question: "Lập hóa đơn USD báo “Hóa đơn USD cần tỷ giá…”?",
        answer:
          "Bảng tỷ giá chưa có tỷ giá nào cho ngày lập hoặc trước ngày đó. Nhập tỷ giá vào ô **Tỷ giá VND/USD** trên form, hoặc thêm tỷ giá ở **Tỷ giá USD** rồi lập lại.",
      },
      {
        question:
          "**Công nợ bán sơn** và **Công nợ khách hàng** khác nhau thế nào?",
        answer:
          "**Công nợ bán sơn** là sổ nợ của khách mua sơn tại quầy, Thủ kho ghi hằng ngày. **Công nợ khách hàng** là nợ theo hóa đơn (INV) của đơn hàng, bằng USD hoặc VND. Hai sổ tách riêng, không cộng lẫn.",
      },
      {
        question: "Tôi không thấy nút lưu trữ khách hàng?",
        answer:
          "Lưu trữ và khôi phục khách hàng do Giám đốc làm. Bạn thêm mới và sửa thông tin khách được.",
      },
      {
        question:
          "Xác nhận đơn cửa hàng báo “Tồn kho không đủ để xác nhận đơn này.”?",
        answer:
          "Số lượng tồn của mặt hàng ít hơn số khách đặt. Nhờ Biên tập nội dung cập nhật số lượng tồn, hoặc trao đổi lại với khách.",
      },
      {
        question: "Phiếu thu hoặc phiếu chi sai sao không xóa được?",
        answer:
          "Phiếu sai được hủy kèm lý do và giữ nguyên trong sổ để đối chiếu. Nhập **Lý do hủy…**, bấm **Hủy phiếu**, rồi ghi lại phiếu thu đúng. Phiếu chi đúng do Kế toán nhà máy ghi lại.",
      },
      {
        question: "Tôi có xem được báo cáo lãi lỗ không?",
        answer:
          "Hệ thống chưa có màn hình báo cáo lãi lỗ. **Tổng quan tài chính** hiện doanh thu theo hóa đơn, đã thu, đã chi và còn phải thu.",
      },
    ],
  },

  CONTENT_CREATOR: {
    key: "CONTENT_CREATOR",
    intro: [
      "Biên tập nội dung là người đưa câu chuyện sơn mài Red Door lên website: tin tức, sản phẩm, bộ sưu tập, mặt hàng của cửa hàng online và nội dung các trang.",
      "Bạn và Giám đốc là hai người xuất bản trên website, và mỗi người sửa được bài của người kia. Bạn cũng cập nhật báo cáo tiến độ mẫu hằng tuần thay cho file Excel; Giám đốc cùng xem và sửa báo cáo này.",
      "Vị trí của bạn không làm việc với đơn hàng hay tài chính. Khi khách đặt mua trên cửa hàng online, Kế toán công ty xác nhận đơn và tồn kho mặt hàng tự trừ; bạn chỉ cần giữ số lượng tồn và giá bán lẻ đúng.",
    ],
    responsibilities: [
      "Viết và xuất bản bài ở **Tin tức**.",
      "Tạo sản phẩm song ngữ, tải ảnh và xuất bản ra catalogue ở **Sản phẩm**.",
      "Tạo bộ sưu tập, tải catalogue PDF và xuất bản ở **Bộ sưu tập**.",
      "Tạo mặt hàng bán lẻ, nhập giá, tồn kho và đưa lên bán ở **Cửa hàng**.",
      "Soạn, gửi duyệt và xuất bản nội dung các trang ở **Nội dung**.",
      "Cập nhật báo cáo tiến độ mẫu mỗi tuần ở **Theo dõi tiến độ mẫu**.",
      "Làm việc được Giám đốc giao ở **Công việc được giao**.",
    ],
    sees: [
      "Mọi bài viết, sản phẩm, bộ sưu tập và nội dung trang, kể cả bản nháp.",
      "Giá bán lẻ VND và USD, số lượng tồn của mặt hàng cửa hàng (giá này là giá công khai trên website).",
      "Báo cáo tiến độ mẫu hằng tuần và các phiên bản đã lưu.",
    ],
    hidden: [
      "Đơn hàng, giá bán nội bộ, chi phí và mọi số liệu tài chính: thuộc Giám đốc, các vị trí kế toán và nhà máy.",
      "Đơn khách đặt trên cửa hàng online: Kế toán công ty và Giám đốc xử lý.",
      "Khách hàng, nhà cung cấp và kho: thuộc Kế toán công ty, Kế toán nhà máy và Thủ kho.",
      "Giao việc, phê duyệt và nhân sự: màn hình riêng của Giám đốc.",
    ],
    workflows: [
      {
        title: "Viết và xuất bản một bài tin tức",
        when: "Khi có tin mới cần đăng lên website.",
        steps: [
          "Mở **Tin tức** và bấm **Viết bài mới**.",
          "Nhập **Tiêu đề** và **Tóm tắt**, chọn **Danh mục**.",
          "Bấm **Thêm khối** để thêm đoạn văn, hình ảnh, trích dẫn…",
          "Bấm **Lưu bản nháp**.",
          "Bấm **Tải ảnh** ở phần **Ảnh đại diện**.",
          "Đọc lại cột **Tiếng Việt** và cột **English** của từng khối.",
          "Bấm **Xuất bản**.",
        ],
        result:
          "Thông báo “Đã xuất bản.” hiện lên và bài có trên website. Bỏ trống tiếng Anh thì khách quốc tế đọc bản tiếng Việt.",
        links: ["/news"],
      },
      {
        title: "Đưa một sản phẩm lên catalogue",
        when: "Khi có sản phẩm mới cần giới thiệu.",
        steps: [
          "Mở **Bộ sưu tập** và kiểm tra bộ sưu tập của sản phẩm đã có chưa.",
          "Mở **Sản phẩm** và bấm **Thêm sản phẩm**.",
          "Nhập **Mã SKU**, chọn **Thuộc bộ sưu tập** và **Danh mục**.",
          "Nhập **Tên sản phẩm**, **Mô tả ngắn** và phần **Thông số**.",
          "Bấm **Lưu bản nháp**.",
          "Bấm **Thêm ảnh** để tải ảnh; ảnh đầu tiên là ảnh chính.",
          "Bấm **Xuất bản**.",
        ],
        result:
          "Sản phẩm hiện trên catalogue trực tuyến. Bật **Đang có sẵn hàng** thì khách thấy nhãn “Có sẵn”.",
        links: ["/collections", "/products"],
      },
      {
        title: "Tạo bộ sưu tập và tải catalogue PDF",
        when: "Khi ra mắt một bộ sưu tập mới.",
        steps: [
          "Mở **Bộ sưu tập**.",
          "Nhập **Tên bộ sưu tập**, **Năm** và **Mô tả ngắn (không bắt buộc)**.",
          "Bấm **Tạo bản nháp**.",
          "Bấm **Tải PDF** ở bộ sưu tập vừa tạo và chọn file catalogue.",
          "Bấm **Xuất bản**.",
          "Bấm **Xem trên website** để kiểm tra.",
        ],
        result:
          "Bộ sưu tập và catalogue PDF hiện trên website. Trang công khai chỉ hiện những gì đã xuất bản.",
        links: ["/collections"],
      },
      {
        title: "Đưa mặt hàng lên cửa hàng online",
        when: "Khi có mặt hàng bán lẻ mới, hoặc khi đổi giá, đổi tồn.",
        steps: [
          "Mở **Cửa hàng** và bấm **Mặt hàng mới**.",
          "Nhập **Tên mặt hàng** và **Mô tả ngắn**.",
          "Nhập **Giá VND (trang tiếng Việt)**, **Giá USD (các ngôn ngữ khác)** và **Số lượng tồn**.",
          "Bấm **Lưu**.",
          "Bấm **Thêm ảnh** để tải ảnh.",
          "Bấm **Đưa lên bán**.",
        ],
        result:
          "Mặt hàng chuyển sang **Đang bán**. Khi cần tạm ngừng, bấm **Ẩn khỏi cửa hàng**; bấm **Bán lại** để bán tiếp.",
        links: ["/shop"],
      },
      {
        title: "Cập nhật báo cáo tiến độ mẫu hằng tuần",
        when: "Mỗi tuần, khi có thay đổi về các mẫu đang làm.",
        steps: [
          "Mở **Theo dõi tiến độ mẫu**.",
          "Bấm **Kế thừa sang tuần mới** để chép các mẫu của tuần trước sang.",
          "Bấm **Sửa** ở mẫu có thay đổi, cập nhật rồi bấm **Áp dụng vào bảng**.",
          "Bấm **Thêm mẫu** nếu có mẫu mới.",
          "Nhập **Nội dung cập nhật lần này (bắt buộc khi lưu)**.",
          "Bấm **Lưu báo cáo**.",
          "Bấm **Xuất Excel** hoặc **In báo cáo** nếu cần gửi đi.",
        ],
        result:
          "Mỗi lần lưu tạo một phiên bản mới kèm người lưu và thời gian; các phiên bản cũ vẫn giữ nguyên. Giám đốc xem được ngay.",
        links: ["/sample-progress"],
      },
      {
        title: "Nhận việc được giao và xin gia hạn",
        when: "Khi Giám đốc giao việc cho bạn.",
        steps: [
          "Mở **Công việc được giao** và chọn bộ lọc **Đang làm**.",
          "Đọc nội dung việc, hạn và **Người giao**.",
          "Bấm **Xong** khi đã làm xong.",
          "Nếu không kịp hạn, bấm **Xin gia hạn**, chọn **Hạn mới**, nhập **Lý do** rồi bấm **Gửi yêu cầu**.",
        ],
        result:
          "Yêu cầu gia hạn đến Giám đốc. Hạn chỉ đổi khi Giám đốc duyệt; câu trả lời hiện trên thẻ việc.",
        links: ["/my-tasks"],
      },
    ],
    faq: [
      {
        question: "Tôi bấm tải ảnh mà không được?",
        answer:
          "Bạn cần bấm **Lưu bản nháp** (hoặc **Lưu** ở **Cửa hàng**) trước rồi mới tải ảnh. Nếu báo “Tải ảnh thất bại — kiểm tra định dạng (JPG/PNG/WebP).”, hãy đổi ảnh sang JPG, PNG hoặc WebP.",
      },
      {
        question: "Sửa một bài đã xuất bản thế nào?",
        answer:
          "Bấm **Biên tập**, sửa rồi bấm **Lưu bản nháp**. Danh sách hiện “· có nháp mới” và trang trên website vẫn giữ bản cũ cho đến khi bạn bấm **Xuất bản** lần nữa.",
      },
      {
        question:
          "Tôi đã bấm **Áp dụng vào bảng** mà báo cáo tiến độ mẫu vẫn chưa lưu?",
        answer:
          "**Áp dụng vào bảng** chỉ đưa thay đổi vào bảng trên màn hình. Thay đổi chỉ được ghi khi bạn bấm **Lưu báo cáo**.",
      },
      {
        question: "Tôi có phải nhập bản tiếng Anh không?",
        answer:
          "Không bắt buộc. Bỏ trống thì khách quốc tế đọc bản tiếng Việt.",
      },
      {
        question: "Bấm xóa mà chưa thấy xóa?",
        answer:
          "Xóa cần bấm hai lần để tránh bấm nhầm: bấm nút xóa (**Xóa**, **Xóa bài**, **Xóa sản phẩm** hoặc **Xóa mặt hàng**), rồi bấm tiếp khi nút đổi thành “Chắc chắn?” hoặc “Xóa hẳn? Bấm lần nữa”. Nội dung đã xóa không khôi phục được.",
      },
      {
        question: "Vì sao tôi không thấy đơn khách đặt trên cửa hàng?",
        answer:
          "Đơn đặt mua do Kế toán công ty và Giám đốc xử lý. Bạn giữ giá và số lượng tồn của mặt hàng; tồn tự trừ khi đơn được xác nhận.",
      },
      {
        question:
          "Lưu mặt hàng báo “Mặt hàng vừa được người khác sửa. Tải lại trang.”?",
        answer:
          "Giám đốc hoặc một người khác vừa sửa mặt hàng này. Tải lại trang, kiểm tra thay đổi của họ rồi sửa lại phần của bạn.",
      },
    ],
  },
};

const allExceptDirector: readonly SystemRoleKey[] = [
  "WAREHOUSE_MANAGER",
  "FACTORY_MANAGER",
  "FACTORY_ACCOUNTANT",
  "COMPANY_ACCOUNTANT",
  "CONTENT_CREATOR",
];

export const guideBasics: readonly GuideBasic[] = [
  {
    title: "Đăng nhập bằng Gmail",
    points: [
      {
        text: "Mở trang đăng nhập, bấm **Tiếp tục với Google** và chọn đúng Gmail bạn dùng cho công việc. Hệ thống không dùng mật khẩu riêng.",
      },
      {
        text: "Lần đầu đăng nhập, bạn thấy màn hình **Tài khoản đang chờ Giám đốc duyệt**. Báo Giám đốc; khi đã được duyệt, tải lại trang để vào hệ thống.",
        roles: allExceptDirector,
      },
      {
        text: "Người mới đăng nhập sẽ chờ ở **Danh sách nhân sự**. Họ chỉ vào được sau khi bạn chọn vai trò và bấm **Duyệt**.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Màn hình **Tài khoản đã bị khoá** nghĩa là Giám đốc đã khoá tài khoản này. Liên hệ Giám đốc nếu cần mở lại.",
        roles: allExceptDirector,
      },
      {
        text: "Màn hình chờ và màn hình khoá ghi dòng **Đang đăng nhập bằng** kèm Gmail. Nếu đó là Gmail sai, bấm **Đăng xuất** rồi đăng nhập lại bằng Gmail đúng.",
      },
      {
        text: "Màn hình **Phiên đăng nhập cần làm mới** hiện khi quyền của tài khoản vừa thay đổi. Bấm **Đăng nhập lại**.",
      },
      {
        text: "Màn hình **Chưa thể kiểm tra quyền truy cập** nghĩa là hệ thống tạm thời không kiểm tra được quyền nên chặn truy cập. Đợi ít phút rồi tải lại trang.",
      },
      {
        text: "Nếu thẻ đăng nhập báo lỗi màu đỏ, đọc câu báo lỗi: Gmail chưa xác minh thì dùng Gmail đã xác minh; máy chủ chưa xử lý được thì thử lại sau ít phút.",
      },
    ],
  },
  {
    title: "Menu và trang Tổng quan",
    points: [
      {
        text: "Trên máy tính, menu nằm ở cột bên trái. Trên điện thoại, menu là một hàng ngang ngay dưới thanh trên cùng: vuốt sang trái hoặc phải để thấy các mục khác.",
      },
      {
        text: "Menu chỉ có các mục của vai trò bạn. **Hướng dẫn sử dụng website** luôn đứng đầu, sau đó là **Tổng quan**. Mục đang mở có nền màu đỏ đậm.",
      },
      {
        text: "Một số mục nằm dưới tiêu đề nhỏ **Tài chính** trong menu.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Menu của Giám đốc có các mục chung ở trên (**Hướng dẫn sử dụng website**, **Tổng quan**, **Trợ lý AI**, **Công việc được giao**), rồi đến các nhóm mang tên từng vai trò theo thứ tự: Giám đốc, Quản lý nhà máy, Thủ kho / Quản lý kho, Kế toán nhà máy & mua hàng, Kế toán công ty, Biên tập nội dung. Bấm vào tiêu đề nhóm để mở hoặc đóng nhóm. Nhóm đang chứa trang bạn mở tự mở sẵn.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Một màn hình dùng chung cho nhiều vai trò, như **Sổ đơn hàng**, được liệt kê lại dưới mỗi nhóm vai trò có màn hình đó.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Trang **Tổng quan** chào bạn theo tên, ghi vai trò của bạn, và có mục **Bắt đầu làm việc** với các thẻ dẫn thẳng đến từng mục trong menu.",
        roles: allExceptDirector,
      },
      {
        text: "Trang **Tổng quan** chào bạn theo tên, ghi vai trò Giám đốc, và có mục **Bắt đầu làm việc** với các thẻ dẫn đến các mục chung và các mục của nhóm Giám đốc. Màn hình của các vị trí khác mở từ các nhóm vai trò trong menu.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Trên **Tổng quan**, thẻ **Danh sách nhân sự** hiện nhãn đỏ “… đang chờ duyệt” khi có người mới cần duyệt.",
        roles: ["DIRECTOR"],
      },
    ],
  },
  {
    title: "Thanh trên cùng",
    points: [
      {
        text: "Bấm logo **Red Door Việt Nam** · **Cổng quản trị** ở góc trái để quay về **Tổng quan**.",
      },
      {
        text: "Bấm **Mở website** để xem trang website công khai của công ty như khách hàng thấy.",
      },
      {
        text: "Tên của bạn hiện ở thanh trên cùng khi màn hình đủ rộng (máy tính bảng, máy tính). Rê chuột lên tên để xem Gmail đang dùng.",
      },
      {
        text: "Bấm **Đăng xuất** khi dùng xong, nhất là trên máy dùng chung. Nút đổi thành **Đang đăng xuất…** rồi đưa bạn về trang đăng nhập.",
      },
    ],
  },
  {
    title: "Thông báo màu vàng, màu xanh và báo lỗi màu đỏ",
    points: [
      {
        text: "Khung màu vàng nhạt hoặc khung màu xanh lá (thường ở đầu trang) là thông báo thao tác đã xong, ví dụ “Đã lưu.”, “Đã đánh dấu xong.”.",
      },
      {
        text: "Khung màu đỏ là báo lỗi, thường bắt đầu bằng “Thao tác không thành công:” kèm lý do. Khi thấy khung đỏ, thao tác đó chưa được ghi: đọc lý do, sửa rồi làm lại.",
      },
      {
        text: "“Bạn không có quyền thực hiện thao tác này.” nghĩa là việc đó thuộc vị trí khác. Đừng thử lại nhiều lần; hỏi người phụ trách.",
      },
      {
        text: "“Hệ thống tạm thời không phản hồi.” nghĩa là máy chủ đang bận hoặc mất kết nối. Đợi một lát rồi thử lại.",
      },
      {
        text: "Nếu cả trang hiện **Không thể hoàn tất yêu cầu**, bấm **Thử lại**. Nếu lỗi lặp lại, chụp màn hình có mã sự cố và gửi cho người phụ trách kỹ thuật.",
      },
      {
        text: "Một số màn hình dạng bảng hiện dòng trạng thái nhỏ như **Đang lưu…**, **Đã lưu** hoặc **Lỗi lưu**. Chờ đến khi thấy **Đã lưu** rồi mới đóng trang.",
        roles: ["WAREHOUSE_MANAGER", "COMPANY_ACCOUNTANT"],
      },
    ],
  },
  {
    title: "Không thấy một mục, hoặc trang báo 404",
    points: [
      {
        text: "Menu chỉ có những màn hình vai trò của bạn được dùng. Không thấy một mục nghĩa là mục đó thuộc vị trí khác, không phải lỗi.",
        roles: allExceptDirector,
      },
      {
        text: "Nếu mở một đường dẫn mà trang hiện số “404” và dòng **Không tìm thấy trang quản trị**, có thể đường dẫn sai hoặc màn hình đó không thuộc vai trò của bạn. Bấm **Về trang quản trị** để quay lại.",
      },
      {
        text: "Trang **Bạn chưa có quyền xem khu vực này** nghĩa là tài khoản chưa có vai trò nào được mở cổng quản trị. Báo Giám đốc.",
        roles: allExceptDirector,
      },
      {
        text: "Nếu bạn thật sự cần một màn hình, hãy hỏi Giám đốc. Mỗi người giữ một vai trò; khi Giám đốc đổi vai trò, menu mới hiện từ lần tải trang kế tiếp.",
        roles: allExceptDirector,
      },
      {
        text: "Giám đốc mở được mọi màn hình. Nếu một nhân viên báo không thấy mục cần dùng, kiểm tra vai trò của họ ở **Danh sách nhân sự**.",
        roles: ["DIRECTOR"],
      },
    ],
  },
  {
    title: "Lưu dữ liệu và thông báo “Bản ghi đã thay đổi”",
    points: [
      {
        text: "Hầu hết thao tác được lưu ngay khi bạn bấm nút của thao tác đó, ví dụ **Lưu**, **Xong**, **Gửi yêu cầu**.",
      },
      {
        text: "Ở các màn hình dạng bảng như **Bảng xuất kho sơn**, **Nguyên vật liệu** và **Hóa đơn bán hàng**, mỗi dòng được ghi ngay khi bấm **Áp dụng**.",
        roles: ["WAREHOUSE_MANAGER"],
      },
      {
        text: "Ở **Hóa đơn bán hàng**, mỗi mặt hàng được ghi vào phiếu ngay khi bấm **Áp dụng**.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Bài viết và sản phẩm lưu bằng **Lưu bản nháp**, bộ sưu tập tạo bằng **Tạo bản nháp**; tất cả chỉ lên website khi bấm **Xuất bản**. Mặt hàng cửa hàng lưu bằng **Lưu** và chỉ bán khi bấm **Đưa lên bán**. Ở **Theo dõi tiến độ mẫu**, thay đổi chỉ được ghi khi bấm **Lưu báo cáo**.",
        roles: ["CONTENT_CREATOR"],
      },
      {
        text: "Thông báo “Bản ghi đã thay đổi; trang đã tải lại, kiểm tra rồi thử lại.” (hoặc câu tương tự) nghĩa là người khác vừa sửa đúng bản ghi đó trước bạn. Hệ thống không ghi đè lên thay đổi của họ: xem lại số liệu mới rồi làm lại thao tác của bạn.",
      },
      {
        text: "Bấm nút một lần và chờ. Đừng bấm liên tiếp hay tải lại trang giữa chừng, để tránh ghi trùng.",
      },
      {
        text: "Nhiều màn hình có **Lịch sử chỉnh sửa** hoặc tab **Nhật ký** ghi rõ ai làm gì, lúc nào. Phiếu sai thường được hủy kèm lý do chứ không xóa hẳn.",
        roles: ["WAREHOUSE_MANAGER", "COMPANY_ACCOUNTANT"],
      },
    ],
  },
  {
    title: "Khi cần giúp đỡ",
    points: [
      {
        text: "Đọc lại phần hướng dẫn của đúng mục bạn đang dùng trong trang **Hướng dẫn sử dụng website**.",
      },
      {
        text: "Hỏi Giám đốc khi không chắc việc đó thuộc ai, khi cần thêm màn hình, hoặc khi tài khoản có vấn đề.",
        roles: allExceptDirector,
      },
      {
        text: "Mở **Trợ lý AI** để hỏi nhanh, ví dụ “Hôm nay tôi cần làm gì?”. Trợ lý chỉ trả lời trong phạm vi dữ liệu bạn được xem, không tự thay đổi dữ liệu, và ghi rõ **Nguồn** của câu trả lời.",
      },
      {
        text: "Bạn có thể bấm **Đính kèm tệp** để gửi tối đa 3 tệp (Excel, CSV, PDF, Word, ảnh) mỗi lượt hỏi. Hội thoại chỉ bạn đọc được và tự xóa sau 7 ngày.",
      },
      {
        text: "Nếu trợ lý báo chưa được cấu hình, hoặc báo lỗi lặp lại, hãy báo người phụ trách kỹ thuật.",
      },
    ],
  },
];
