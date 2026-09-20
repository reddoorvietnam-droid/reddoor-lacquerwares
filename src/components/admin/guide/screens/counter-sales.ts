import type { ScreenGuide } from "../guide-types";

/**
 * Guide sections for the paint counter: Hóa đơn bán hàng (Phiếu bán hàng) and
 * Công nợ bán sơn. Both screens belong to the storekeeper and the Company
 * Accountant; the only difference between them on screen is that the Company
 * Accountant may restate a customer's opening balance.
 */
export const counterSalesScreens: readonly ScreenGuide[] = [
  {
    path: "/sales-slips",
    title: "Hóa đơn bán hàng",
    summary:
      "Nơi lập, xác nhận, hủy, in và xuất file các Phiếu bán hàng của kho sơn khi bán sơn, vật tư tại quầy. Bản in giữ đúng mẫu PHIẾU BÁN HÀNG như file Excel trước đây.",
    layout: [
      {
        text: "Đầu trang: tiêu đề **Hóa đơn bán hàng** và dòng tóm tắt tổng số phiếu cùng lần cập nhật gần nhất (lúc nào, ai sửa). Ngay bên dưới là nút **+ Tạo phiếu bán hàng**.",
      },
      {
        text: "Hàng bộ lọc: **Từ ngày**, **Đến ngày**, **Người nhận**, **Tìm**, **Trạng thái**, **Người lập**, **Sắp xếp**, ô tick **Hiện phiếu đã hủy**, nút **Xóa bộ lọc** và dòng đếm **Hiển thị x/y phiếu**.",
      },
      {
        text: "Bảng danh sách phiếu gồm các cột **Mã phiếu**, **Ngày**, **Trạng thái**, **Người nhận**, **Tổng tiền**, **Nội dung**, **Số mặt hàng**, **Người lập**, **Cập nhật**. Cột **Thao tác** luôn nằm sát mép phải, có nút **Mở** và **In**. Dưới bảng có nút **Tải thêm (… phiếu còn lại)** khi còn phiếu chưa hiện.",
      },
      {
        text: "Trang một phiếu (bấm **Mở**, hoặc trang **Phiếu mới** khi tạo): tiêu đề là mã phiếu kèm nhãn trạng thái; dòng thông tin người lập, giờ tạo, giờ cập nhật, giờ xác nhận hoặc hủy và tình trạng lưu.",
      },
      {
        text: "Hàng nút của trang phiếu: **← Danh sách**; **Xác nhận** (phiếu nháp đã lưu) hoặc **Mở lại để sửa** (phiếu đã xác nhận); **Hủy phiếu** (phiếu chưa hủy); **Dán từ Excel** (phiếu còn sửa được); **Xem bản in**, **Xuất PDF**, **Xuất Excel** (phiếu đã được lưu).",
      },
      {
        text: "Phần đầu phiếu có các ô **Ngày**, **Người nhận hàng**, **Đơn vị**, **Nội dung** và **Ghi chú nội bộ (không in)**.",
      },
      {
        text: "Bảng mặt hàng gồm **STT**, **Mã VT**, **Vật tư**, **ĐVT**, **Số lượng**, **Giá**, **Thành tiền**; khi phiếu còn sửa được có thêm cột **Thao tác** với nút **Sửa**, **Xóa**, và nút **Thêm mặt hàng** phía trên bảng. Dưới bảng là **Tổng tiền**, **Tổng cộng tiền thanh toán** và **Bằng chữ**.",
      },
      {
        text: "Cuối trang phiếu lặp lại các nút **Xem bản in**, **Xuất PDF**, **Xuất Excel** và có nút **Lịch sử chỉnh sửa**; bấm vào sẽ hiện bảng **Thời gian**, **Người thực hiện**, **Thao tác**, **Chi tiết**.",
      },
      {
        text: "Trang bản in có nút **← Quay lại phiếu**, **In**, **Xuất PDF**, **Xuất Excel** và tờ phiếu khổ A4: tên và địa chỉ công ty, tiêu đề PHIẾU BÁN HÀNG, ngày, người nhận, đơn vị, nội dung, bảng hàng, tổng tiền, số tiền bằng chữ và bốn ô ký Người lập phiếu, Người nhận hàng, Kế toán trưởng, Giám đốc.",
      },
    ],
    capabilities: [
      {
        text: "Tạo phiếu bán hàng mới. Phiếu tự lưu trong lúc bạn nhập, không có nút Lưu.",
      },
      {
        text: "Chọn người nhận hàng trong danh mục bằng mã hoặc tên, hoặc gõ tay một tên chưa có trong danh mục.",
      },
      {
        text: "Thêm từng mặt hàng bằng **Thêm mặt hàng**: gõ mã hoặc tên vật tư, nhập số lượng; tên, ĐVT và giá danh mục tự hiện ra.",
      },
      {
        text: "Sửa đơn giá của từng dòng ở ô **Giá**; xóa trống ô này để dùng lại giá danh mục.",
      },
      {
        text: "Dán nhiều dòng một lúc từ bảng tính bằng **Dán từ Excel** (tối đa 500 dòng mỗi lần), xem kết quả kiểm tra rồi mới thêm vào phiếu.",
      },
      {
        text: "Sửa hoặc xóa từng mặt hàng khi phiếu còn **Nháp**.",
      },
      {
        text: "Xác nhận phiếu để khóa lại; mở lại phiếu đã xác nhận để sửa (phải ghi lý do); hủy phiếu (phải ghi lý do).",
      },
      {
        text: "Xem bản in và in ra giấy A4; tải file PDF hoặc Excel đúng mẫu PHIẾU BÁN HÀNG.",
      },
      {
        text: "Xem lịch sử của phiếu: ai tạo, sửa, xác nhận, mở lại, hủy, xuất file, vào lúc nào và đã đổi những gì.",
      },
      {
        text: "Tìm và lọc phiếu theo khoảng ngày, người nhận (tên hoặc mã), mã phiếu, mã hoặc tên vật tư, trạng thái, người lập; sắp xếp theo lúc tạo phiếu (**Mới nhất**, **Cũ nhất**), theo ngày bán hoặc theo tổng tiền; xem cả phiếu đã hủy.",
      },
    ],
    limits: [
      {
        text: "Không xóa hẳn được phiếu. Phiếu sai thì hủy kèm lý do; phiếu đã hủy vẫn được lưu để tra cứu.",
      },
      {
        text: "Không sửa được phiếu **Đã xác nhận** hay **Đã hủy**. Phiếu đã xác nhận phải bấm **Mở lại để sửa** trước; phiếu đã hủy không mở lại được.",
      },
      {
        text: "Không xác nhận được phiếu chưa có người nhận, chưa có mặt hàng, có dòng chưa chọn mã hoặc mã không nằm trong danh mục, có số lượng trống hoặc bằng 0, hoặc có dòng chưa có đơn giá.",
      },
      {
        text: "Không thêm được mã vật tư mới ở màn hình này; mã phải có sẵn trong danh mục sơn dùng chung. Khi ghi bán hàng ở **Công nợ bán sơn** có nút **+ Thêm mã sơn mới** để thêm mã vào danh mục đó.",
      },
      {
        text: "Phiếu bán hàng không trừ tồn kho sơn và không tự ghi công nợ cho khách. Khách mua nợ thì phải ghi riêng ở **Công nợ bán sơn**.",
      },
      {
        text: "Phiếu bán hàng không tự tạo dòng nào ở **Bảng xuất kho sơn**. Nếu lượng sơn bán ra cần có trong bảng đó, bạn ghi riêng ở đó.",
        roles: ["WAREHOUSE_MANAGER"],
      },
      {
        text: "Đây là chứng từ nội bộ, không phải hóa đơn giá trị gia tăng điện tử: không có mã số thuế, ký hiệu, mẫu số hay thuế suất.",
      },
      {
        text: "Phiếu bán hàng khác với **Hóa đơn (INV)** trong nhóm tài chính (hóa đơn ghi doanh thu đơn hàng xuất khẩu); hai nơi không dùng chung số liệu.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Không có nút nhập phiếu từ file Excel. Các phiếu cũ trong file Excel đã được chuyển vào sẵn và hiện mã dạng **Excel · tên sheet**.",
      },
      {
        text: "Xác nhận, mở lại hay hủy phiếu không cần Giám đốc duyệt và không gửi thông báo cho ai.",
      },
    ],
    flows: [
      {
        title: "Lập một phiếu bán hàng mới",
        when: "Khi khách mua sơn, vật tư tại quầy và cần phiếu giao cho khách.",
        steps: [
          "Bấm **+ Tạo phiếu bán hàng** ở trang danh sách.",
          "Kiểm tra ô **Ngày**; mặc định là hôm nay, đổi lại nếu bán vào ngày khác.",
          "Gõ mã hoặc tên người nhận vào ô **Người nhận hàng** rồi chọn trong danh sách gợi ý. Dòng chữ nhỏ bên dưới hiện **Liên kết danh mục: …** khi đã khớp.",
          "Nhập **Đơn vị** và **Nội dung** nếu cần in trên phiếu; ghi **Ghi chú nội bộ (không in)** nếu muốn nhắc riêng.",
          "Bấm **Thêm mặt hàng**.",
          "Gõ mã hoặc tên vật tư vào ô **Mã vật tư** rồi chọn trong gợi ý; kiểm tra tên, ĐVT và giá danh mục hiện ngay dưới ô.",
          "Nhập **Số lượng** (số lẻ dùng dấu chấm, ví dụ 0.5); sửa ô **Giá** nếu bán khác giá danh mục.",
          "Bấm **Áp dụng** hoặc nhấn Enter. Mặt hàng được ghi vào phiếu và khung nhập trống lại cho mặt hàng tiếp theo.",
          "Lặp lại cho các mặt hàng còn lại, xong thì bấm **Hủy** để đóng khung nhập.",
          "Kiểm tra **Tổng tiền**, **Tổng cộng tiền thanh toán** và **Bằng chữ** dưới bảng.",
          "Chờ dòng thông tin ở đầu trang hiện **Đã lưu**.",
        ],
        result:
          "Phiếu ở trạng thái **Nháp**, đã có mã phiếu (dạng PBH-năm tháng ngày-số thứ tự) và nằm trong danh sách. Bạn có thể sửa tiếp cho tới khi xác nhận. Không cần Giám đốc duyệt.",
      },
      {
        title: "Dán nhiều mặt hàng từ Excel",
        when: "Khi danh sách hàng đã có sẵn trong một bảng tính Excel.",
        steps: [
          "Trong Excel, xếp các cột theo thứ tự Mã VT, Số lượng, Giá. Cột Giá có thể để trống để lấy giá danh mục.",
          "Bôi đen các dòng hàng cần lấy (không lấy dòng tiêu đề) rồi sao chép.",
          "Mở phiếu còn **Nháp** và bấm **Dán từ Excel**.",
          "Dán vào ô **Các dòng từ Excel**.",
          "Bấm **Đọc dữ liệu**.",
          "Xem bảng kết quả: dòng **Hợp lệ** sẽ được thêm, dòng **Lỗi** ghi rõ lý do và sẽ bị bỏ qua.",
          "Bấm **Thêm … dòng** để đưa các dòng hợp lệ vào phiếu, hoặc **Đóng** nếu không muốn thêm.",
          "Kiểm tra lại bảng mặt hàng và tổng tiền.",
        ],
        result:
          "Các dòng hợp lệ được thêm vào cuối phiếu và lưu ngay; thông báo xanh “Đã thêm … mặt hàng từ dữ liệu dán.” hiện lên. Dòng lỗi không được thêm: sửa trong Excel rồi dán lại, hoặc nhập tay bằng **Thêm mặt hàng**.",
      },
      {
        title: "Sửa hoặc xóa một mặt hàng trên phiếu nháp",
        steps: [
          "Mở phiếu có trạng thái **Nháp**.",
          "Bấm **Sửa** ở dòng cần sửa; khung **Sửa mặt hàng** hiện ra.",
          "Đổi mã, số lượng hoặc giá rồi bấm **Áp dụng**.",
          "Để bỏ một dòng, bấm **Xóa** ở dòng đó.",
          "Đọc lại tên mặt hàng trong khung **Xóa mặt hàng**, rồi bấm **Xóa mặt hàng**, hoặc **Giữ lại** nếu bấm nhầm.",
        ],
        result:
          "Phiếu được lưu ngay và tổng tiền tính lại. Mọi thay đổi được ghi vào **Lịch sử chỉnh sửa**.",
      },
      {
        title: "Xác nhận phiếu",
        when: "Khi người nhận, mặt hàng, số lượng và giá đã đúng và phiếu được coi là giao dịch chính thức.",
        steps: [
          "Mở phiếu **Nháp** và chờ dòng thông tin hiện **Đã lưu**.",
          "Bấm **Xác nhận**.",
          "Nếu hiện khung đỏ **Chưa thể xác nhận phiếu:**, sửa từng lỗi trong danh sách rồi bấm **Xác nhận** lại.",
          "Đọc nội dung khung **Xác nhận phiếu bán hàng?**.",
          "Bấm **Xác nhận phiếu**, hoặc **Quay lại** nếu chưa muốn xác nhận.",
        ],
        result:
          "Phiếu chuyển sang **Đã xác nhận**; người nhận, mặt hàng, số lượng và đơn giá bị khóa. Thông báo xanh “Đã xác nhận phiếu …” hiện lên. Không cần Giám đốc duyệt và không có thông báo gửi đi.",
      },
      {
        title: "In phiếu hoặc tải file PDF, Excel",
        steps: [
          "Bấm **In** ở cột **Thao tác** trong danh sách, hoặc mở phiếu rồi bấm **Xem bản in**.",
          "Kiểm tra tờ phiếu hiện trên màn hình.",
          "Bấm **In**, chọn máy in và khổ A4 trong cửa sổ in của trình duyệt.",
          "Muốn gửi file, bấm **Xuất PDF** hoặc **Xuất Excel** và chờ chữ “Đang tạo PDF…” hoặc “Đang tạo Excel…” trên nút biến mất; file tự tải về máy.",
          "Bấm **← Quay lại phiếu** để về trang phiếu.",
        ],
        result:
          "Tờ in chỉ có phiếu, không in menu hay nút bấm; **Ghi chú nội bộ (không in)** không xuất hiện trên giấy và trong file. Mỗi lần xuất file PDF hoặc Excel được ghi vào lịch sử của phiếu.",
      },
      {
        title: "Mở lại phiếu đã xác nhận để sửa",
        when: "Khi phát hiện sai sót trên một phiếu đã xác nhận.",
        steps: [
          "Mở phiếu **Đã xác nhận**.",
          "Bấm **Mở lại để sửa**; khung **Mở lại phiếu đã xác nhận** hiện ra.",
          "Nhập lý do vào ô **Lý do mở lại (bắt buộc)**, ví dụ “Sửa lại đơn giá.”.",
          "Bấm **Mở lại phiếu**, hoặc **Quay lại** nếu đổi ý.",
          "Sửa phiếu như một phiếu nháp.",
          "Bấm **Xác nhận** lại khi đã sửa xong.",
        ],
        result:
          "Phiếu về **Nháp** để sửa, mã phiếu giữ nguyên; thông báo xanh “Đã mở lại phiếu để sửa.” hiện lên và lý do mở lại được ghi vào **Lịch sử chỉnh sửa**. Nhớ xác nhận lại sau khi sửa.",
      },
      {
        title: "Hủy phiếu",
        when: "Khi phiếu lập nhầm hoặc giao dịch không còn.",
        steps: [
          "Mở phiếu cần hủy (phiếu nháp hoặc đã xác nhận).",
          "Bấm **Hủy phiếu**; khung **Hủy phiếu bán hàng** hiện ra.",
          "Nhập lý do vào ô **Lý do hủy (bắt buộc)**, ví dụ “Ghi nhầm người nhận.”.",
          "Bấm **Hủy phiếu này**, hoặc **Quay lại** nếu đổi ý.",
        ],
        result:
          "Phiếu chuyển sang **Đã hủy** và bị ẩn khỏi danh sách mặc định (tick **Hiện phiếu đã hủy** hoặc chọn **Trạng thái** là **Đã hủy** để thấy lại). Bản in và file PDF có chữ ĐÃ HỦY in chìm, file Excel có tiêu đề “PHIẾU BÁN HÀNG (ĐÃ HỦY)”. Phiếu không bị xóa và không mở lại được.",
      },
      {
        title: "Tìm một phiếu cũ",
        steps: [
          "Chọn khoảng ngày ở **Từ ngày** và **Đến ngày**.",
          "Gõ tên hoặc mã người nhận vào ô **Người nhận**, hoặc gõ mã phiếu, mã hay tên vật tư vào ô **Tìm**.",
          "Chọn **Trạng thái** hoặc **Người lập** nếu cần.",
          "Tick **Hiện phiếu đã hủy** nếu muốn thấy cả phiếu đã hủy.",
          "Bấm vào **Mã phiếu** hoặc nút **Mở** để xem phiếu.",
          "Bấm **Xóa bộ lọc** để về danh sách đầy đủ.",
        ],
        result:
          "Danh sách lọc ngay khi bạn chọn; ô chữ lọc sau khi bạn ngừng gõ một chút. Dòng **Hiển thị x/y phiếu** cho biết số phiếu đang hiện trên tổng số phiếu khớp; bấm **Tải thêm** để xem tiếp.",
      },
      {
        title: "Xem lịch sử chỉnh sửa của một phiếu",
        steps: [
          "Mở phiếu cần xem.",
          "Bấm **Lịch sử chỉnh sửa** ở cuối trang.",
          "Đọc từng dòng: **Thời gian**, **Người thực hiện**, **Thao tác** (ví dụ **Tạo phiếu**, **Sửa phiếu**, **Xác nhận**, **Mở lại để sửa**, **Hủy phiếu**, **Xuất file**) và **Chi tiết** thay đổi kèm lý do.",
          "Bấm lại **Lịch sử chỉnh sửa** để đóng bảng.",
        ],
        result:
          "Bạn biết ai đã đổi số lượng, đơn giá, người nhận hay trạng thái của phiếu và vào lúc nào. Thời gian lấy theo giờ máy chủ, không sửa được.",
      },
    ],
    terms: [
      {
        term: "Nháp",
        meaning:
          "Phiếu đang soạn, còn sửa được, chưa phải giao dịch chính thức.",
      },
      {
        term: "Đã xác nhận",
        meaning:
          "Phiếu chính thức. Người nhận, mặt hàng, số lượng và đơn giá bị khóa; muốn sửa phải mở lại kèm lý do.",
      },
      {
        term: "Đã hủy",
        meaning:
          "Phiếu đã bị hủy kèm lý do. Vẫn được lưu để tra cứu, hiện gạch ngang trong danh sách, bản in có chữ ĐÃ HỦY.",
      },
      {
        term: "DRAFT, CONFIRMED, CANCELLED",
        meaning:
          "Chữ tiếng Anh hiện trong cột **Chi tiết** của **Lịch sử chỉnh sửa** khi phiếu đổi trạng thái, ví dụ “Trạng thái: DRAFT → CONFIRMED”. DRAFT là **Nháp**, CONFIRMED là **Đã xác nhận**, CANCELLED là **Đã hủy**.",
      },
      {
        term: "Mã phiếu",
        meaning:
          "Mã nội bộ dạng PBH-20260908-001: PBH, ngày trên phiếu lúc tạo, rồi số thứ tự của các phiếu cùng ngày đó. Mã được cấp ở lần tự lưu đầu tiên và không đổi. Đây không phải số hóa đơn điện tử.",
      },
      {
        term: "Excel · tên sheet",
        meaning:
          "Phiếu cũ chuyển từ file Excel sang, không có mã phiếu nên hiện tên sheet gốc thay cho mã.",
      },
      {
        term: "Nhập từ Excel",
        meaning:
          "Tên hiện ở **Người lập** hoặc **Người thực hiện** cho những gì được chuyển sẵn từ file Excel cũ, không phải do một người bấm trên màn hình.",
      },
      {
        term: "Cần kiểm tra",
        meaning:
          "Nhãn vàng cạnh trạng thái của phiếu chuyển từ Excel có điểm chưa khớp. Di chuột vào nhãn hoặc mở phiếu để đọc danh sách điểm cần kiểm tra.",
      },
      {
        term: "Mã lạ",
        meaning:
          "Nhãn vàng ở dòng có mã vật tư không có trong danh mục (thường gặp ở phiếu cũ). Phải sửa sang mã đúng thì mới xác nhận được.",
      },
      {
        term: "Mã VT, Vật tư, ĐVT",
        meaning:
          "Mã vật tư, tên vật tư và đơn vị tính, lấy từ danh mục sơn dùng chung.",
      },
      {
        term: "Giá danh mục",
        meaning:
          "Giá bán mặc định lưu trong danh mục sơn, chỉ dùng làm giá gợi ý khi chọn mã. Dòng đã có trong phiếu giữ nguyên giá của nó dù sau này danh mục đổi giá.",
      },
      {
        term: "Thành tiền, Tổng tiền, Tổng cộng tiền thanh toán",
        meaning:
          "Thành tiền = Số lượng × Giá, máy tự tính. Tổng tiền là cộng các dòng. Tổng cộng tiền thanh toán bằng Tổng tiền vì mẫu phiếu không có thuế giá trị gia tăng hay chiết khấu.",
      },
      {
        term: "Bằng chữ",
        meaning: "Tổng số tiền viết bằng chữ, máy tự viết.",
      },
      {
        term: "Liên kết danh mục / Tên nhập tay, không liên kết danh mục",
        meaning:
          "Dòng chữ nhỏ dưới ô **Người nhận hàng**: cho biết người nhận đã khớp với một người trong danh mục, hay chỉ là tên bạn gõ tay.",
      },
      {
        term: "Ghi chú nội bộ (không in)",
        meaning:
          "Ghi chú chỉ người mở phiếu trên hệ thống thấy; không in lên phiếu và không có trong file PDF, Excel.",
      },
      {
        term: "Chờ lưu…, Đang lưu…, Đã lưu, Lỗi lưu",
        meaning:
          "Tình trạng tự lưu ở dòng thông tin đầu trang phiếu. **Đã lưu** là thay đổi đã nằm an toàn trên hệ thống; **Lỗi lưu** là chưa lưu được, đọc thông báo đỏ để sửa.",
      },
      {
        term: "Người lập",
        meaning: "Người đã tạo phiếu.",
      },
      {
        term: "Excel",
        meaning:
          "Phần mềm bảng tính. **Xuất Excel** tải về file bảng tính đúng mẫu phiếu; **Dán từ Excel** lấy các dòng bạn sao chép từ bảng tính.",
      },
      {
        term: "PDF",
        meaning:
          "Loại file tài liệu mở được trên máy tính và điện thoại, giữ đúng bố cục khi gửi đi hoặc in.",
      },
    ],
    tips: [
      {
        text: "Không có nút Lưu: phiếu tự lưu sau mỗi lần nhập. Nếu bạn đóng trang khi phiếu chưa lưu xong, trình duyệt sẽ hỏi lại; hãy chờ **Đã lưu** rồi mới đóng.",
      },
      {
        text: "Số lẻ dùng dấu chấm (0.5); dấu phẩy chỉ để phân cách hàng nghìn (1,000). Gõ “0,5” sẽ báo lỗi “Số không hợp lệ”.",
      },
      {
        text: "Các nút **Xác nhận**, **Mở lại để sửa**, **Hủy phiếu**, **Xuất PDF**, **Xuất Excel** tạm mờ khi phiếu đang lưu; chờ vài giây là bấm được.",
      },
      {
        text: "Gõ mã người nhận rồi rời khỏi ô thì ô tự đổi thành tên đầy đủ sẽ in trên phiếu. Tên gõ tay được in đúng như bạn gõ.",
      },
      {
        text: "Thông báo xanh như “Đã thêm … × …”, “Đã cập nhật … × …”, “Đã xóa mặt hàng …”, “Đã xác nhận phiếu …”, “Đã mở lại phiếu để sửa.”, “Đã hủy phiếu …” nghĩa là thao tác đã xong và đã lưu.",
      },
      {
        text: "Khung vàng “Mặt hàng … đã có trong phiếu (giữ nguyên, không tự gộp).” chỉ là lời nhắc: một mã đang nằm ở nhiều dòng. Nếu nhập trùng do nhầm, hãy sửa số lượng ở một dòng và xóa dòng kia.",
      },
      {
        text: "Khung vàng “Phiếu nhập từ Excel (…) cần kiểm tra:” liệt kê các điểm chưa khớp của phiếu cũ; đối chiếu với file gốc trước khi xác nhận.",
      },
      {
        text: "Khung đỏ “Phiếu đã được người khác cập nhật. Vui lòng tải lại dữ liệu.” nghĩa là người khác vừa sửa cùng phiếu. Bấm **Tải lại** để lấy bản mới nhất; phần bạn vừa gõ mà chưa lưu sẽ mất và cần nhập lại.",
      },
      {
        text: "Khung đỏ “Chưa thể xác nhận phiếu:” kèm danh sách như “Chưa nhập người nhận hàng.”, “Phiếu chưa có mặt hàng nào.”, “Dòng 2: chưa có đơn giá.”. Sửa đúng dòng được nêu rồi bấm **Xác nhận** lại.",
      },
      {
        text: "Khung đỏ “Có ô nhập số chưa hợp lệ; sửa lại để lưu.” hoặc “Chưa lưu được phiếu; hãy sửa lỗi rồi thử lại.” nghĩa là phiếu chưa được lưu. Sửa ô báo lỗi trước khi xác nhận, hủy hay xuất file.",
      },
      {
        text: "Chữ đỏ dưới ô khi thêm mặt hàng: “Chưa chọn mã vật tư”, “Mã không có trong danh mục”, “Số lượng phải lớn hơn 0”, “Số không hợp lệ”. Sửa ô đó rồi bấm **Áp dụng** lại.",
      },
      {
        text: "Khi dán từ Excel, lỗi “Dán tối đa 500 dòng mỗi lần.” thì chia nhỏ để dán nhiều lần; lỗi dạng “Dòng dán 3 (số lượng): dùng dấu chấm cho số thập phân…” thì sửa số ở dòng đó trong Excel rồi dán lại.",
      },
      {
        text: "Nút **Mở lại phiếu** và **Hủy phiếu này** còn mờ cho tới khi bạn nhập lý do.",
      },
      {
        text: "Khung đỏ “Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.” hoặc “Không thể đọc/ghi phiếu bán hàng lúc này. Giữ bản nháp và thử lại.” thường do mạng hoặc máy chủ. Đừng đóng trang, chờ một lát rồi thử lại; ở trang danh sách có thể bấm **Thử lại**.",
      },
      {
        text: "Phiếu nháp vẫn in được, nhưng nên xác nhận trước khi in giao khách để số liệu trên giấy không bị sửa sau đó.",
      },
      {
        text: "Nếu khách mua nợ, nhớ ghi thêm phát sinh bán hàng ở **Công nợ bán sơn**; phiếu bán hàng không tự ghi công nợ.",
      },
    ],
  },
  {
    path: "/receivables",
    title: "Công nợ bán sơn",
    summary:
      "Sổ công nợ của các cơ sở, thợ mua sơn tại quầy, thay cho file công nợ Excel. Màn hình cho biết mỗi khách còn nợ bao nhiêu và những giao dịch nào tạo nên con số đó; mọi số dư đều do máy tính lại từ sổ.",
    layout: [
      {
        text: "Đầu trang: tiêu đề **Công nợ bán sơn** và dòng tóm tắt số khách còn nợ cùng tổng tiền nợ, số khách trả trước (nếu có) và mốc “tính đến” ngày nào.",
      },
      {
        text: "Thanh công cụ: bốn thẻ **Tổng hợp công nợ**, **Phát sinh bán hàng**, **Thanh toán / Giảm nợ**, **Nhật ký**; nút **Xuất Excel** và **In báo cáo**; ô **Từ ngày**, **Đến ngày** và nút **Bỏ lọc ngày**. Khoảng ngày áp dụng cho bảng tổng hợp, hai thẻ sổ, khung chi tiết khách và file Excel; thẻ **Nhật ký** không lọc theo ngày.",
      },
      {
        text: "Thẻ **Tổng hợp công nợ**: bốn ô số **Tổng dư nợ**, **Đã thanh toán**, **Dư trả trước**, **Khách đang theo dõi**; bộ lọc **Tìm khách hàng**, **Trạng thái**, **Phát sinh**, **Sắp xếp** và ô tick **Hiện cả khách chưa phát sinh**.",
      },
      {
        text: "Bảng tổng hợp có các cột **STT**, **Mã khách**, **Tên khách hàng**, **Số điện thoại**, **Dư đầu**, **Phát sinh tăng**, **Phát sinh giảm**, **Dư hiện tại**, **Chú ý** và dòng **Cộng tổng** ở cuối.",
      },
      {
        text: "Thẻ **Phát sinh bán hàng**: ô **Tìm trong sổ**, **Trạng thái**, nút **+ Ghi phát sinh bán hàng**; bảng **Ngày tháng**, **Mã khách**, **Tên khách**, **Chứng từ**, **Mã hàng**, **Mặt hàng**, **Số lượng**, **Đơn giá**, **Thành tiền**, **Ghi chú**. Dòng chưa hủy có nút **Sửa**, dòng đã ghi sổ có thêm nút **Hủy**. Dưới bảng là số dòng, tổng đã ghi sổ và nút **Trang trước**, **Trang sau** khi sổ quá 100 dòng.",
      },
      {
        text: "Thẻ **Thanh toán / Giảm nợ**: giống thẻ bán hàng, với nút **+ Ghi nhận thanh toán / giảm nợ** và các cột **Loại**, **Diễn giải**, **Số tiền** thay cho các cột hàng hóa.",
      },
      {
        text: "Thẻ **Nhật ký**: bảng **Thời điểm**, **Người thực hiện**, **Thao tác**, **Nội dung**, mới nhất ở trên, 50 dòng mỗi trang.",
      },
      {
        text: "Khung **Chi tiết công nợ** của một khách (mở khi bấm mã khách ở bất kỳ bảng nào): mã, số điện thoại, địa chỉ; bốn ô **Dư đầu kỳ**, **Phát sinh tăng**, **Phát sinh giảm**, **Dư hiện tại**; nút **Xuất sổ công nợ** và **Đóng**; bảng **Ngày**, **Chứng từ**, **Loại**, **Diễn giải**, **Tăng**, **Giảm**, **Số dư**, bắt đầu bằng dòng **Dư đầu kỳ**; dòng đã ghi sổ có nút **Hủy**.",
      },
      {
        text: "Trong khung **Chi tiết công nợ** có thêm nút **Sửa dư đầu kỳ**.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
    ],
    capabilities: [
      {
        text: "Xem công nợ từng khách tính đến một ngày (chỉ chọn **Đến ngày**), hoặc theo một kỳ (chọn cả **Từ ngày** và **Đến ngày**).",
      },
      {
        text: "Tìm, lọc theo trạng thái nợ hoặc có hay không có phát sinh, sắp xếp bảng tổng hợp; hiện cả khách chưa có phát sinh.",
      },
      {
        text: "Tìm trong sổ bán hàng hoặc sổ thanh toán theo mã khách, tên, mã hàng, diễn giải, chứng từ; lọc theo **Đã ghi sổ**, **Nháp**, **Đã hủy**.",
      },
      {
        text: "Bấm vào số ở cột **Phát sinh tăng** hoặc **Phát sinh giảm** để mở đúng các dòng tạo nên số đó.",
      },
      {
        text: "Mở sổ chi tiết của một khách với số dư sau từng giao dịch, và tải sổ công nợ riêng của khách bằng **Xuất sổ công nợ** để gửi đối chiếu.",
      },
      {
        text: "Ghi một lần khách mua nhiều mặt hàng trên cùng một phiếu nhập: một khách, một ngày, một số chứng từ, mỗi mặt hàng một dòng.",
      },
      {
        text: "Ghi khách trả tiền hoặc giảm nợ theo năm loại: **Thanh toán**, **Trừ tiền sơn**, **Trừ tiền gỗ / vật tư**, **Trả lại hàng**, **Bù trừ khác**.",
      },
      {
        text: "Chọn **Ghi sổ** để tính ngay vào số dư, hoặc **Lưu nháp** để giữ lại mà chưa tính.",
      },
      {
        text: "Thêm mã sơn mới vào danh mục sơn dùng chung ngay trong lúc ghi bán hàng, kèm tên hàng, đơn vị tính và giá bán.",
      },
      {
        text: "Sửa trực tiếp một dòng đã ghi hoặc bản nháp (ngày, khách, số chứng từ, mã hàng, số lượng, đơn giá, loại giảm nợ, diễn giải, số tiền, ghi chú) và ghi lý do sửa.",
      },
      {
        text: "Hủy một dòng đã ghi sổ kèm lý do, từ bảng sổ hoặc từ khung chi tiết khách; dòng vẫn nằm trong sổ nhưng thôi tính vào số dư.",
      },
      {
        text: "Sửa dư đầu kỳ (dư đầu ngày 02/01/2026) của một khách, bắt buộc ghi lý do.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Tải file Excel của thẻ đang xem theo khoảng ngày đang lọc, và in trang đang xem bằng **In báo cáo**.",
      },
      {
        text: "Xem **Nhật ký** mọi thay đổi: ai làm, lúc nào, làm gì, với khách nào và lý do.",
      },
    ],
    limits: [
      {
        text: "Không gõ trực tiếp được **Dư hiện tại**. Số dư sai thì sửa ở gốc: dòng giao dịch sai, hoặc dư đầu kỳ.",
      },
      {
        text: "Bạn không sửa được dư đầu kỳ của khách; nút **Sửa dư đầu kỳ** chỉ có ở tài khoản Kế toán công ty và Giám đốc. Nếu dư đầu kỳ sai, báo Kế toán công ty sửa.",
        roles: ["WAREHOUSE_MANAGER"],
      },
      {
        text: "Không xóa hẳn được dòng nào. Dòng sai thì sửa, hoặc hủy kèm lý do.",
      },
      {
        text: "Không sửa được dòng **Đã hủy**; hãy ghi một giao dịch mới.",
      },
      {
        text: "Không đổi được dòng bán hàng thành dòng giảm nợ hay ngược lại; hãy hủy dòng đó rồi ghi lại ở đúng thẻ.",
      },
      {
        text: "Không gõ được **Thành tiền** của dòng bán hàng; máy luôn tính bằng Số lượng × Đơn giá.",
      },
      {
        text: "Không ghi được cho ngày trong tương lai. Khách đã ngừng theo dõi (nhãn **Ngừng**) không có trong danh sách chọn khi ghi mới.",
      },
      {
        text: "Màn hình chưa có nút ghi sổ một bản nháp đã lưu, cũng chưa có nút hủy bản nháp; bản nháp chỉ sửa được bằng **Sửa** và không tính vào số dư.",
      },
      {
        text: "Màn hình chưa có chỗ thêm khách hàng mới hay sửa tên, số điện thoại của khách.",
      },
      {
        text: "Không có nút nhập file Excel công nợ; số liệu từ file công nợ 2026 đã được chuyển vào sẵn.",
      },
      {
        text: "Sổ này chỉ ghi tiền: không trừ tồn kho và không tạo phiếu bán hàng. **Trả lại hàng** chỉ giảm nợ, không nhập hàng lại kho.",
      },
      {
        text: "Sổ này khác với **Công nợ khách hàng** trong nhóm tài chính (công nợ đơn hàng xuất khẩu và hóa đơn INV); hai sổ không dùng chung số liệu.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Ghi sổ, sửa hay hủy đều có hiệu lực ngay, không cần Giám đốc duyệt và không gửi thông báo cho ai.",
      },
    ],
    flows: [
      {
        title: "Ghi một lần khách mua hàng nợ",
        when: "Khi cơ sở, thợ lấy sơn hoặc vật tư mà chưa trả tiền.",
        steps: [
          "Mở thẻ **Phát sinh bán hàng**.",
          "Bấm **+ Ghi phát sinh bán hàng**.",
          "Chọn khách ở ô **Khách hàng** (nếu bạn đang lọc sổ theo một khách, ô này đã chọn sẵn khách đó).",
          "Kiểm tra **Ngày tháng** (mặc định hôm nay); nhập **Số chứng từ** và **Ghi chú chung** nếu có.",
          "Gõ mã vào ô **Mã hàng hóa** ở dòng 1 và chọn trong gợi ý; cột **Mặt hàng** hiện tên và đơn vị tính, ô **Đơn giá** tự điền giá bán nếu danh mục có và ô đang trống.",
          "Nhập **Số lượng**; sửa **Đơn giá** nếu bán giá khác; ghi **Ghi chú** riêng cho dòng nếu cần.",
          "Bấm **+ Thêm dòng** cho mỗi mặt hàng tiếp theo; bấm **Xóa** để bỏ dòng thừa.",
          "Kiểm tra **Thành tiền** từng dòng và dòng **Tổng cộng … dòng** ở cuối bảng.",
          "Bấm **Ghi sổ … dòng**. Chỉ bấm **Lưu nháp** khi còn chưa chắc số liệu.",
        ],
        result:
          "Mỗi mặt hàng thành một dòng đã ghi sổ trong sổ bán hàng, cùng số chứng từ. **Phát sinh tăng** và **Dư hiện tại** của khách tăng ngay; khung nhập đóng lại và thông báo xanh “Đã ghi sổ … dòng bán hàng cho …” hiện lên. Không cần Giám đốc duyệt.",
      },
      {
        title: "Thêm mã sơn mới khi đang ghi bán hàng",
        when: "Khi mã hàng khách mua chưa có trong danh mục (cột **Mặt hàng** hiện “Mã chưa có trong danh mục”).",
        steps: [
          "Gõ mã mới vào ô **Mã hàng hóa** của dòng.",
          "Bấm nút **+ Thêm mã “…” vào danh mục** bên dưới bảng. Nếu chưa gõ mã lạ nào, nút có tên **+ Thêm mã sơn mới**.",
          "Kiểm tra ô **Mã hàng hóa**, rồi nhập **Tên hàng**, **Đơn vị tính** (mặc định Kg) và **Giá bán**.",
          "Bấm **Thêm vào danh mục**, hoặc **Bỏ** để đóng.",
          "Kiểm tra dòng bán hàng đã hiện tên hàng và đơn giá.",
          "Ghi sổ lần bán như bình thường.",
        ],
        result:
          "Mã mới vào danh mục sơn dùng chung với **Bảng xuất kho sơn** và **Hóa đơn bán hàng**; thông báo “Đã thêm mã … vào danh mục sơn.” hiện lên. Giá bán chỉ là giá mặc định cho lần bán sau; các dòng đã ghi giữ nguyên giá lúc bán.",
      },
      {
        title: "Ghi khách trả tiền hoặc giảm nợ",
        when: "Khi khách trả tiền, được trừ tiền, trả lại hàng hoặc có khoản bù trừ.",
        steps: [
          "Mở thẻ **Thanh toán / Giảm nợ**.",
          "Bấm **+ Ghi nhận thanh toán / giảm nợ**.",
          "Chọn **Khách hàng** và kiểm tra **Ngày tháng**.",
          "Chọn **Loại giảm nợ**: **Thanh toán**, **Trừ tiền sơn**, **Trừ tiền gỗ / vật tư**, **Trả lại hàng** hoặc **Bù trừ khác**.",
          "Nhập **Số tiền** (chỉ gõ chữ số, không dấu phân cách nghìn).",
          "Nhập **Số chứng từ**, **Diễn giải** và **Ghi chú** nếu có.",
          "Bấm **Ghi sổ**.",
        ],
        result:
          "Dòng đã ghi sổ được thêm; **Phát sinh giảm** tăng và **Dư hiện tại** của khách giảm ngay, thông báo xanh “Đã ghi sổ … cho …” hiện lên. Nếu khách trả dư, số dư thành số âm và hiện nhãn **Dư trả trước**.",
      },
      {
        title: "Tra cứu và đối chiếu công nợ với một khách",
        when: "Khi khách hỏi còn nợ bao nhiêu, hoặc cần gửi sổ cho khách đối chiếu.",
        steps: [
          "Mở thẻ **Tổng hợp công nợ**.",
          "Chọn **Đến ngày** nếu cần số nợ tính đến một ngày; chọn thêm **Từ ngày** nếu cần xem theo kỳ.",
          "Gõ mã, tên hoặc số điện thoại vào **Tìm khách hàng**.",
          "Bấm vào **Mã khách** để mở khung **Chi tiết công nợ**.",
          "Đọc bảng sổ: mỗi dòng có số **Tăng**, **Giảm** và **Số dư** ngay sau giao dịch đó.",
          "Bấm **Xuất sổ công nợ** để tải file Excel sổ công nợ riêng của khách.",
          "Bấm **Đóng** khi xong.",
        ],
        result:
          "Bạn có số dư của khách theo đúng khoảng ngày đã chọn và một file để gửi khách đối chiếu; thông báo “Đã tải sổ công nợ của …” hiện lên.",
      },
      {
        title: "Xem các giao dịch tạo nên một con số",
        steps: [
          "Ở bảng tổng hợp, bấm vào số ở cột **Phát sinh tăng** hoặc **Phát sinh giảm** của khách cần xem. Trong khung chi tiết khách, bấm vào số ở ô cùng tên cũng được.",
          "Đọc các dòng của khách đó trong thẻ **Phát sinh bán hàng** hoặc **Thanh toán / Giảm nợ** vừa mở.",
          "Bấm **Bỏ lọc khách: …** để xem lại toàn bộ sổ.",
        ],
        result:
          "Thẻ sổ chỉ hiện dòng của khách bạn chọn cho tới khi bỏ lọc; bạn có thể sửa, hủy hay ghi thêm cho khách đó ngay tại đó.",
      },
      {
        title: "Sửa một dòng ghi sai",
        when: "Khi gõ nhầm ngày, khách, mã hàng, số lượng, đơn giá hoặc số tiền.",
        steps: [
          "Tìm dòng sai ở thẻ **Phát sinh bán hàng** hoặc **Thanh toán / Giảm nợ**, dùng ô **Tìm trong sổ** nếu cần.",
          "Bấm **Sửa** ở dòng đó; dòng biến thành các ô nhập.",
          "Sửa đúng ô bị sai.",
          "Nhập lý do vào ô **Lý do sửa** ngay bên dưới, ví dụ “gõ nhầm số tiền”.",
          "Bấm **Lưu**, hoặc **Bỏ** để thôi sửa.",
        ],
        result:
          "Thông báo “Đã sửa dòng; số dư đã tính lại.” hiện lên. **Nhật ký** ghi lại người sửa, thời điểm và lý do.",
      },
      {
        title: "Hủy một giao dịch",
        when: "Khi giao dịch ghi nhầm hoàn toàn hoặc ghi trùng.",
        steps: [
          "Bấm **Hủy** ở dòng đã ghi sổ, trong bảng sổ hoặc trong khung chi tiết khách.",
          "Đọc câu hỏi trong khung đỏ hiện ra bên dưới bảng để chắc đúng khách, đúng ngày, đúng số tiền.",
          "Nhập lý do vào ô **Lý do hủy (bắt buộc)**.",
          "Bấm **Xác nhận hủy**, hoặc **Bỏ** nếu đổi ý.",
        ],
        result:
          "Dòng chuyển sang **Đã hủy**, hiện gạch ngang kèm “Lý do hủy: …” và thôi tính vào số dư. Thông báo “Đã hủy giao dịch; số dư đã tính lại.” hiện lên.",
      },
      {
        title: "Sửa dư đầu kỳ của một khách",
        when: "Khi số dư đầu ngày 02/01/2026 của khách bị sai.",
        roles: ["COMPANY_ACCOUNTANT"],
        steps: [
          "Ở thẻ **Tổng hợp công nợ**, bấm **Mã khách** để mở **Chi tiết công nợ**.",
          "Bấm **Sửa dư đầu kỳ**.",
          "Nhập số đúng vào ô **Dư đầu ngày 02/01/2026**; nhập số âm (có dấu trừ) nếu khách đã trả trước.",
          "Nhập lý do vào ô **Lý do điều chỉnh (bắt buộc)**.",
          "Bấm **Lưu dư đầu kỳ**, hoặc **Bỏ** để thôi.",
        ],
        result:
          "Thông báo “Đã cập nhật dư đầu kỳ; số dư đã tính lại.” hiện lên; **Dư đầu** và **Dư hiện tại** của khách đổi theo. **Nhật ký** ghi thao tác **Sửa dư đầu kỳ** (hoặc **Tạo dư đầu kỳ** nếu khách chưa có dư đầu kỳ) kèm lý do.",
      },
      {
        title: "Xuất Excel và in báo cáo",
        steps: [
          "Chọn thẻ cần xuất và khoảng ngày.",
          "Ở thẻ **Tổng hợp công nợ**, tick hoặc bỏ tick **Hiện cả khách chưa phát sinh** tùy file cần có những khách nào.",
          "Bấm **Xuất Excel**; file tự tải về máy.",
          "Bấm **In báo cáo** để mở cửa sổ in của trình duyệt cho trang đang xem.",
        ],
        result:
          "Thông báo “Đã tải file Excel theo bộ lọc đang xem.” hiện lên. Thẻ **Tổng hợp công nợ** và **Nhật ký** xuất bảng tổng hợp; thẻ **Phát sinh bán hàng** xuất sổ chi tiết bán hàng; thẻ **Thanh toán / Giảm nợ** xuất bảng thanh toán. Sổ bán hàng và bảng thanh toán trong file chỉ gồm các dòng đã ghi sổ.",
      },
      {
        title: "Xem nhật ký thay đổi",
        steps: [
          "Mở thẻ **Nhật ký**.",
          "Đọc từ trên xuống; dòng mới nhất nằm trên cùng.",
          "Xem cột **Thao tác** (ví dụ **Ghi phát sinh bán hàng (nhiều mặt hàng)**, **Ghi giảm công nợ**, **Sửa dòng giao dịch**, **Hủy giao dịch**, **Thêm mã sơn**, **Sửa mã sơn / đơn giá**, **Sửa dư đầu kỳ**) và cột **Nội dung** (mã khách, loại giao dịch, lý do, tùy thao tác).",
          "Bấm **Trang sau** để xem các thay đổi cũ hơn.",
        ],
        result:
          "Bạn biết ai đã ghi, sửa hay hủy giao dịch nào, vào lúc nào và vì sao.",
      },
    ],
    terms: [
      {
        term: "Dư đầu, Dư đầu kỳ",
        meaning:
          "Số khách còn nợ lúc bắt đầu kỳ, tức dư đầu ngày 02/01/2026. Khi chọn **Từ ngày**, dư đầu kỳ đã cộng mọi giao dịch trước ngày đó nên số dư không bị mất khi lọc.",
      },
      {
        term: "Phát sinh tăng",
        meaning:
          "Tổng tiền bán hàng đã ghi sổ trong khoảng đang xem; làm tăng số khách nợ.",
      },
      {
        term: "Phát sinh giảm",
        meaning:
          "Tổng tiền thanh toán, trừ tiền, trả lại hàng và bù trừ đã ghi sổ trong khoảng đang xem; làm giảm số khách nợ.",
      },
      {
        term: "Dư hiện tại",
        meaning:
          "Dư đầu + Phát sinh tăng − Phát sinh giảm. Máy tự tính lại sau mỗi lần ghi, không gõ tay được.",
      },
      {
        term: "Tăng, Giảm, Số dư",
        meaning:
          "Ba cột trong khung chi tiết khách: số tiền giao dịch làm tăng hoặc giảm nợ, và số khách còn nợ ngay sau giao dịch đó.",
      },
      {
        term: "Còn nợ, Đã thanh toán, Dư trả trước",
        meaning:
          "Nhãn ở cột **Chú ý** và ô lọc **Trạng thái**: số dư lớn hơn 0, bằng 0, hoặc nhỏ hơn 0. Số âm nghĩa là khách đã trả trước, không phải lỗi.",
      },
      {
        term: "Đã ghi sổ",
        meaning:
          "Giao dịch chính thức, đã tính vào số dư. Trong bảng sổ, dòng đã ghi sổ không mang nhãn; chọn **Trạng thái** là **Đã ghi sổ** để chỉ xem những dòng này.",
      },
      {
        term: "Nháp",
        meaning:
          "Giao dịch mới lưu tạm, chưa tính vào số dư và chưa có trong file Excel xuất ra.",
      },
      {
        term: "Đã hủy",
        meaning:
          "Giao dịch đã hủy kèm lý do; vẫn nằm trong sổ, hiện gạch ngang, không tính vào số dư.",
      },
      {
        term: "Ngừng",
        meaning:
          "Nhãn cạnh mã khách đã ngừng theo dõi công nợ; không chọn được khách này khi ghi giao dịch mới.",
      },
      {
        term: "Bán hàng",
        meaning:
          "Loại của dòng phát sinh bán hàng trong sổ chi tiết khách; làm tăng nợ.",
      },
      {
        term: "Thanh toán",
        meaning: "Khách trả tiền.",
      },
      {
        term: "Trừ tiền sơn, Trừ tiền gỗ / vật tư",
        meaning:
          "Nợ được giảm bằng cách trừ vào tiền sơn, hoặc tiền gỗ, vật tư, thay vì khách trả tiền.",
      },
      {
        term: "Trả lại hàng",
        meaning:
          "Khách trả lại hàng và được giảm nợ tương ứng. Chỉ ghi tiền, không nhập hàng lại kho.",
      },
      {
        term: "Bù trừ khác",
        meaning: "Khoản giảm nợ không thuộc các loại trên.",
      },
      {
        term: "Chứng từ, Số chứng từ",
        meaning:
          "Số phiếu hoặc giấy tờ đi kèm giao dịch. Không bắt buộc nhưng giúp đối chiếu.",
      },
      {
        term: "Tổng dư nợ, Khách đang theo dõi",
        meaning:
          "Hai ô số trên bảng tổng hợp: tổng tiền các khách còn nợ, và số khách đang hiện trong bảng. Các ô số luôn tính theo đúng những dòng đang hiện.",
      },
      {
        term: "Dòng có dấu ⚠",
        meaning:
          "Cảnh báo ở dòng chuyển từ file cũ cần kiểm tra, ví dụ “Mã khách không có trong danh mục”, “Mã hàng không có trong danh mục sơn”, “Thành tiền trống trong file gốc”, “Thành tiền khác Số lượng × Đơn giá”, “Diễn giải chưa xác định được loại”, “Ngày nằm ngoài kỳ 2026”.",
      },
      {
        term: "Dấu * cạnh tên ô",
        meaning:
          "Ô bắt buộc phải nhập, ví dụ Khách hàng, Ngày tháng, Mã hàng hóa, Số lượng, Đơn giá, Loại giảm nợ, Số tiền.",
      },
      {
        term: "Excel",
        meaning:
          "Phần mềm bảng tính. File xuất ra giữ đúng mẫu của file công nợ cũ; bảng tổng hợp trong file có sẵn ngày lập báo cáo và phần ký Người lập, Phụ trách kế toán, Giám đốc.",
      },
      {
        term: "₫",
        meaning: "Đồng Việt Nam.",
      },
    ],
    tips: [
      {
        text: "Khi số liệu đã chắc chắn, hãy bấm **Ghi sổ** thay vì **Lưu nháp**: bản nháp không tính vào số dư, và màn hình chưa có nút ghi sổ lại bản nháp.",
      },
      {
        text: "Dòng bán hàng thiếu mã hàng, số lượng hoặc đơn giá sẽ không được ghi. Nút **Ghi sổ** chỉ bấm được khi đã chọn khách, có ngày và có ít nhất một dòng đủ ba ô đó.",
      },
      {
        text: "Mã hàng chưa có trong danh mục vẫn ghi sổ được nhưng dòng sẽ không có tên hàng và đơn vị tính. Nên thêm mã vào danh mục trước khi ghi sổ.",
      },
      {
        text: "Chỉ dùng **+ Thêm mã sơn mới** cho mã thật sự chưa có. Nếu gõ vào đó một mã đã có, tên hàng, đơn vị tính và giá bán của mã đó trong danh mục dùng chung sẽ bị thay bằng những gì bạn vừa nhập.",
      },
      {
        text: "Gõ số liền, không dấu phân cách nghìn (ví dụ 5000000); số lẻ dùng dấu chấm (0.5). Sai định dạng sẽ báo lỗi có câu “Nhập số tiền không âm, tối đa 2 chữ số thập phân” hoặc “Nhập số không âm, tối đa 8 chữ số thập phân”; số tiền bằng 0 báo “Số tiền phải lớn hơn 0”.",
      },
      {
        text: "Lỡ bấm **Ghi sổ** hai lần liền, hoặc mạng chập chờn đúng lúc đang gửi, cũng không tạo dòng trùng. Nhưng nếu mở lại khung nhập và gõ lại cùng lần bán thì sẽ thành hai lần bán.",
      },
      {
        text: "Chỉ gõ nhầm thì dùng **Sửa** thay vì hủy rồi ghi lại: sổ gọn hơn và **Nhật ký** vẫn giữ lại dấu vết.",
      },
      {
        text: "Luôn điền **Lý do sửa** dù ô này không bắt buộc, để người đối chiếu sau hiểu vì sao số thay đổi. Bấm **Lưu** mà chưa đổi ô nào thì dòng chỉ đóng lại, không có gì được ghi.",
      },
      {
        text: "Để trống cả hai ô ngày là xem toàn kỳ 2026, tính từ dư đầu ngày 02/01/2026. Muốn biết khách nợ bao nhiêu tại một ngày, chỉ cần chọn **Đến ngày**.",
      },
      {
        text: "Mặc định bảng tổng hợp ẩn các khách không có dư đầu, không có giao dịch trong khoảng đang xem và số dư bằng 0; tick **Hiện cả khách chưa phát sinh** để thấy tất cả.",
      },
      {
        text: "File Excel đi theo khoảng ngày đang chọn và ô **Hiện cả khách chưa phát sinh**, không đi theo ô tìm kiếm, ô trạng thái hay lọc theo một khách. Muốn file của riêng một khách, dùng **Xuất sổ công nợ** trong khung chi tiết.",
      },
      {
        text: "Đổi giá bán trong danh mục không làm đổi các dòng đã ghi; mỗi dòng giữ giá lúc bán. Muốn sửa giá của một dòng, dùng **Sửa** ở dòng đó.",
      },
      {
        text: "Phiếu ở **Hóa đơn bán hàng** không tự ghi vào sổ này; khách mua nợ thì phải ghi phát sinh bán hàng ở đây.",
      },
      {
        text: "Thông báo xanh như “Đã ghi sổ …”, “Đã lưu nháp … dòng; bản nháp chưa tính vào số dư.”, “Đã lưu bản nháp; bản nháp chưa tính vào số dư.”, “Đã sửa dòng; số dư đã tính lại.”, “Đã hủy giao dịch; số dư đã tính lại.” nghĩa là thao tác đã xong và bảng đã cập nhật.",
      },
      {
        text: "Lỗi đỏ “Không ghi sổ cho ngày trong tương lai.”: đổi ngày về hôm nay hoặc trước đó. “Khách hàng đã ngừng theo dõi công nợ.”: khách đã ngừng, không ghi thêm được. “Thiếu số lượng hoặc đơn giá.”: điền đủ hai ô.",
      },
      {
        text: "Lỗi đỏ “Dòng đã được người khác cập nhật. Tải lại để xem số mới nhất.”: người khác vừa sửa cùng dòng. Tải lại trang, kiểm tra số mới rồi mới sửa tiếp.",
      },
      {
        text: "Lỗi đỏ “Từ ngày phải trước Đến ngày.”: chọn lại khoảng ngày cho đúng thứ tự.",
      },
      {
        text: "Lỗi đỏ “Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.” hoặc “Không thể đọc/ghi công nợ lúc này. Giữ bản nháp và thử lại.”: kiểm tra mạng, chờ một lát rồi tải lại trang.",
      },
    ],
  },
];
