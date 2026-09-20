import type { ScreenGuide } from "../guide-types";

/**
 * The Director's own desk: handing out work, deciding approvals, the
 * position reference, staff sign-ins and the website's quote requests.
 * Every screen here opens for the Director alone, so no entry is narrowed.
 */
export const directorDeskScreens: readonly ScreenGuide[] = [
  {
    path: "/tasks",
    title: "Giao việc",
    summary:
      "Nơi bạn giao việc cho từng người kèm hạn hoàn thành, theo dõi ai đang làm gì, ai quá hạn, trả lời các yêu cầu xin gia hạn, duyệt đề xuất của trợ lý và kiểm tra nhắc việc đã gửi đi. Người được giao thấy việc của mình ở mục **Công việc được giao**.",
    layout: [
      {
        text: "Trên cùng là tên trang và một dòng giải thích. Ngay dưới là dải thông báo sau mỗi thao tác: màu vàng khi thành công, màu đỏ bắt đầu bằng “Thao tác không thành công:” khi có lỗi.",
      },
      {
        text: "Khung **Xin gia hạn chờ duyệt**: danh sách các yêu cầu dời hạn đang chờ bạn trả lời. Mỗi yêu cầu có tên việc, người xin, **Hạn hiện tại**, **Xin dời sang**, mã đơn (nếu có), **Lý do**, ô **Ghi chú cho người xin (tùy chọn)** và hai nút **Duyệt gia hạn**, **Từ chối**. Yêu cầu gửi sớm nhất nằm trên cùng.",
      },
      {
        text: "Hàng nút lọc **Đang mở**, **Đã xong**, **Đã hủy**, **Tất cả**. Khi mới mở trang, bộ lọc là **Đang mở**. Việc xếp theo hạn: việc không hạn nằm trên cùng, sau đó là việc có hạn sớm nhất. Ở **Tất cả**, việc đã hủy đứng trước, rồi đến việc đã xong, cuối cùng là việc đang mở.",
      },
      {
        text: "Danh sách thẻ việc. Mỗi thẻ có tên việc, hạn, người làm, mã đơn (nếu có), ghi chú và các nhãn như **Bước**, **Từ đề xuất AI**, **Xong lúc**. Việc đang mở có nút **Xong**, ô **Lý do hủy…**, nút **Hủy** và mục **Sửa việc** bấm vào để mở ra. Việc đã xong chỉ có nút **Mở lại**. Việc đã hủy không có nút nào.",
      },
      {
        text: "Khung **Giao việc mới**: biểu mẫu tạo việc với các ô **Việc**, **Hạn (ngày)**, **Mã đơn (tùy chọn)**, **Ưu tiên**, **Người làm**, **Ghi chú** và nút **Lưu việc**. Ô **Người làm** chọn sẵn chính bạn (dòng bắt đầu bằng **Tôi**).",
      },
      {
        text: "Khung **Đề xuất của trợ lý chờ duyệt**: các danh sách việc hoặc kế hoạch đơn hàng do Trợ lý AI soạn nháp. Mỗi đề xuất có tiêu đề, ngày giờ soạn, danh sách việc, mục **Giả định** (nếu có), ô **Lý do từ chối (bắt buộc)** và hai nút **Duyệt và tạo việc**, **Từ chối**.",
      },
      {
        text: "Khung **Nhắc việc**: chế độ gửi, tình trạng lịch tự động, nút **Chạy nhắc việc ngay** và bảng 20 tin nhắc, tin báo gần nhất (mới nhất ở trên) kèm trạng thái gửi.",
      },
      {
        text: "Khung **Zalo của tôi** ở cuối trang: liên kết Zalo của chính bạn để nhận tin nhắc qua Zalo.",
      },
    ],
    capabilities: [
      {
        text: "Giao việc cho bất kỳ tài khoản nào đang làm việc, kể cả cho chính bạn (dòng có chữ **Tôi**).",
      },
      {
        text: "Đặt hạn theo ngày. Hạn được tính đến hết ngày đó theo giờ Việt Nam. Có thể để trống, khi đó thẻ việc ghi **Không hạn**.",
      },
      {
        text: "Gắn việc với một đơn hàng bằng cách nhập mã đơn. Mã đơn trên thẻ việc bấm được để mở đơn hàng đó.",
      },
      {
        text: "Đặt mức **Ưu tiên** là **Bình thường** hoặc **Cao**. Việc ưu tiên cao có dấu chấm than đỏ “!” trước tên.",
      },
      {
        text: "Lọc danh sách việc theo **Đang mở**, **Đã xong**, **Đã hủy** hoặc xem **Tất cả**.",
      },
      {
        text: "Sửa một việc đang mở: đổi tên việc, hạn, mức ưu tiên, người làm hoặc ghi chú trong mục **Sửa việc**, rồi bấm **Lưu thay đổi**.",
      },
      {
        text: "Đánh dấu một việc là xong bằng nút **Xong**, mở lại việc đã xong bằng nút **Mở lại**.",
      },
      {
        text: "Hủy một việc đang mở, bắt buộc ghi lý do vào ô **Lý do hủy…** rồi bấm **Hủy**.",
      },
      {
        text: "Trả lời yêu cầu xin gia hạn bằng **Duyệt gia hạn** hoặc **Từ chối**, có thể kèm ghi chú gửi cho người xin.",
      },
      {
        text: "Duyệt đề xuất của trợ lý bằng **Duyệt và tạo việc**, hoặc từ chối bằng **Từ chối** kèm lý do. Bấm **Giả định** (nếu có) để xem các giả định trợ lý đã dùng.",
      },
      {
        text: "Bấm **Chạy nhắc việc ngay** để gửi nhắc việc ngay lúc đó, không cần chờ lịch tự động.",
      },
      {
        text: "Xem trạng thái từng tin nhắc đã gửi qua email hoặc Zalo, và bấm **Gửi lại** với tin bị lỗi, thất bại hoặc bị bỏ qua.",
      },
      {
        text: "Lấy mã liên kết Zalo cho tài khoản của bạn bằng **Lấy mã liên kết**, hoặc bỏ liên kết bằng **Gỡ liên kết**.",
      },
    ],
    limits: [
      {
        text: "Mỗi việc chỉ giao cho một người. Muốn nhiều người cùng làm, hãy tạo một việc cho từng người.",
      },
      {
        text: "Chỉ chọn được người có tài khoản đang làm việc. Người đang chờ duyệt hoặc đã bị khoá không có trong danh sách **Người làm**.",
      },
      {
        text: "Việc đã hủy không mở lại được và không sửa được. Việc đã xong phải bấm **Mở lại** trước khi sửa.",
      },
      {
        text: "Bạn không xin gia hạn thay người khác. Chỉ người được giao mới bấm xin gia hạn, ở mục **Công việc được giao** của họ.",
      },
      {
        text: "Không gắn việc mới vào đơn hàng đã đóng hoặc đã hủy.",
      },
      {
        text: "Mục **Sửa việc** không có ô mã đơn, nên không đổi được đơn hàng của một việc. Muốn gắn sang đơn khác, hãy hủy việc cũ và giao việc mới.",
      },
      {
        text: "Trang này không có việc lặp lại định kỳ, đính kèm tệp hay trao đổi bình luận trong việc.",
      },
      {
        text: "Việc kết nối Zalo OA của công ty không làm ở trang này mà ở mục **Thiết lập**, bằng nút **Kết nối Zalo**. Nút đó chỉ hiện khi phần cài đặt Zalo trên máy chủ đã xong.",
      },
    ],
    flows: [
      {
        title: "Giao một việc mới",
        when: "Khi bạn cần một người làm một việc trước một ngày nhất định.",
        steps: [
          "Kéo xuống khung **Giao việc mới**.",
          "Nhập nội dung việc vào ô **Việc**.",
          "Chọn ngày ở ô **Hạn (ngày)**, hoặc để trống nếu việc không có hạn.",
          "Nhập mã đơn vào ô **Mã đơn (tùy chọn)** nếu việc thuộc một đơn hàng.",
          "Chọn **Bình thường** hoặc **Cao** ở ô **Ưu tiên**.",
          "Chọn người ở ô **Người làm**.",
          "Nhập hướng dẫn thêm vào ô **Ghi chú** nếu cần.",
          "Bấm **Lưu việc**.",
        ],
        result:
          "Trang báo “Đã lưu việc.” và việc hiện trong danh sách **Đang mở**. Người được giao thấy việc ở mục **Công việc được giao**. Hệ thống gửi ngay tin báo cho họ qua email, và qua Zalo nếu họ đã liên kết Zalo (ban đêm thì tin chờ đến sáng). Việc bạn giao cho chính mình thì không gửi tin.",
      },
      {
        title: "Sửa việc, đổi hạn hoặc đổi người làm",
        when: "Khi nội dung, hạn hoặc người phụ trách của một việc đang mở thay đổi.",
        steps: [
          "Bấm **Đang mở** để lọc các việc đang mở.",
          "Tìm thẻ việc cần sửa.",
          "Bấm **Sửa việc** ở cuối thẻ để mở biểu mẫu.",
          "Sửa ô **Việc**, **Hạn (ngày)**, **Ưu tiên**, **Người làm** hoặc **Ghi chú**.",
          "Bấm **Lưu thay đổi**.",
        ],
        result:
          "Trang báo “Đã cập nhật.”. Nếu bạn đổi hạn hoặc đổi người làm, người đang giữ việc (người mới, nếu bạn đổi người) nhận tin báo qua email, và qua Zalo nếu đã liên kết; người làm cũ không nhận tin. Mỗi lần bấm **Lưu thay đổi** đều gỡ yêu cầu xin gia hạn đang chờ của việc đó, kể cả khi bạn không đổi hạn, và người xin không nhận tin báo nào về việc này.",
      },
      {
        title: "Trả lời yêu cầu xin gia hạn",
        when: "Khi người được giao xin dời hạn. Bạn nhận tin báo qua email (và Zalo nếu bạn đã liên kết). Bấm đường dẫn trong thư sẽ mở trang này ở bộ lọc **Tất cả**, với thẻ việc được viền vàng.",
        steps: [
          "Mở khung **Xin gia hạn chờ duyệt** ở đầu trang.",
          "Đọc **Hạn hiện tại**, ngày **Xin dời sang** và **Lý do**.",
          "Nhập lời nhắn vào ô **Ghi chú cho người xin (tùy chọn)** nếu muốn.",
          "Bấm **Duyệt gia hạn** để đồng ý, hoặc bấm **Từ chối** để giữ hạn cũ.",
        ],
        result:
          "Khi duyệt, trang báo “Đã duyệt gia hạn; hạn mới đã có hiệu lực.”, hạn đổi ngay sang ngày xin và nhắc việc tính theo hạn mới. Khi từ chối, trang báo “Đã từ chối gia hạn; hạn cũ giữ nguyên.”. Trong cả hai trường hợp, người xin nhận câu trả lời kèm ghi chú của bạn qua email và Zalo (nếu đã liên kết).",
      },
      {
        title: "Đánh dấu việc đã xong hoặc mở lại",
        when: "Khi một việc đã hoàn thành, hoặc một việc đã đánh dấu xong nhưng cần làm tiếp.",
        steps: [
          "Tìm thẻ việc trong bộ lọc **Đang mở**.",
          "Bấm **Xong** trên thẻ.",
          "Muốn làm lại việc đã xong, bấm bộ lọc **Đã xong**.",
          "Bấm **Mở lại** trên thẻ việc đó.",
        ],
        result:
          "Khi bấm **Xong**, trang báo “Đã đánh dấu xong.”, việc chuyển sang **Đã xong**, thẻ ghi **Xong lúc** kèm giờ và không còn nhắc việc. Không có tin nào gửi cho người làm. Khi bấm **Mở lại**, trang báo “Đã mở lại việc.” và việc quay về **Đang mở**.",
      },
      {
        title: "Hủy một việc",
        when: "Khi việc không cần làm nữa.",
        steps: [
          "Tìm thẻ việc trong bộ lọc **Đang mở**.",
          "Nhập lý do vào ô nhỏ **Lý do hủy…** trên thẻ.",
          "Bấm **Hủy**.",
        ],
        result:
          "Trang báo “Đã hủy việc.”. Việc chuyển sang **Đã hủy**, lý do hiện trong ngoặc kép trên thẻ, không còn nhắc việc và không mở lại được.",
      },
      {
        title: "Duyệt hoặc từ chối đề xuất của trợ lý",
        when: "Sau khi bạn nhờ Trợ lý AI lập kế hoạch cho một đơn hàng hoặc đề xuất danh sách việc. Trợ lý chỉ soạn nháp, chưa có việc nào được tạo.",
        steps: [
          "Kéo xuống khung **Đề xuất của trợ lý chờ duyệt**.",
          "Đọc tiêu đề đề xuất (**Kế hoạch đơn** kèm mã đơn, hoặc **Việc đề xuất**).",
          "Kiểm tra từng dòng việc: tên việc, ngày hạn và người được đề xuất.",
          "Bấm **Giả định** (nếu có) để đọc các giả định trợ lý đã dùng.",
          "Bấm **Duyệt và tạo việc** nếu đồng ý.",
          "Nếu không đồng ý, nhập lý do vào ô **Lý do từ chối (bắt buộc)** rồi bấm **Từ chối**.",
        ],
        result:
          "Khi duyệt, trang báo “Đã duyệt đề xuất và tạo việc.”, các việc xuất hiện trong danh sách với nhãn **Từ đề xuất AI**. Người được giao không nhận tin báo ngay lúc này; họ thấy việc ở mục **Công việc được giao** và nhận nhắc việc theo hạn. Người được đề xuất nào không còn làm việc thì việc đó thành **Chưa gán**. Khi từ chối, trang báo “Đã từ chối đề xuất.” và không việc nào được tạo.",
      },
      {
        title: "Kiểm tra và gửi lại nhắc việc",
        when: "Khi muốn biết một người đã được nhắc chưa, hoặc có tin nhắc bị lỗi.",
        steps: [
          "Kéo xuống khung **Nhắc việc**.",
          "Xem dòng **Chế độ gửi** và dòng lịch tự động để biết hệ thống có đang gửi thật không.",
          "Tìm dòng tin theo thời gian và tên người nhận trong bảng.",
          "Đọc trạng thái ở cột thứ tư, và dòng lỗi màu xám bên dưới nếu có.",
          "Bấm **Gửi lại** ở dòng có trạng thái **Lỗi, sẽ thử lại**, **Thất bại hẳn** hoặc **Bỏ qua**.",
        ],
        result:
          "Trang báo “Đã xếp lại để gửi.”, dòng đó về trạng thái **Chờ gửi** và được gửi ở lần chạy nhắc việc kế tiếp. Muốn gửi luôn, bấm **Chạy nhắc việc ngay**.",
      },
      {
        title: "Chạy nhắc việc ngay",
        when: "Khi lịch tự động chưa được cài, hoặc bạn vừa giao việc có hạn gần và muốn nhắc ngay.",
        steps: [
          "Kéo xuống khung **Nhắc việc**.",
          "Bấm **Chạy nhắc việc ngay**.",
          "Đọc dải thông báo màu vàng ở đầu trang.",
        ],
        result:
          "Thông báo có dạng “Đã chạy nhắc việc. · tạo …, gửi …, bỏ qua …, lỗi …”, cho biết số tin đã tạo, đã gửi, bị bỏ qua và bị lỗi. Mỗi việc chỉ được nhắc một lần cho mỗi loại nhắc trong một ngày, nên bấm nhiều lần không gửi trùng. Nếu bấm vào ban đêm (mặc định từ 21 giờ đến 7 giờ sáng), tin nhắc mới được tạo nhưng chờ đến sáng mới gửi.",
      },
      {
        title: "Liên kết Zalo của bạn",
        when: "Khi bạn muốn nhận tin nhắc việc qua Zalo trên điện thoại.",
        steps: [
          "Kéo xuống khung **Zalo của tôi**.",
          "Bấm **Lấy mã liên kết**.",
          "Ghi lại mã hiện sau dòng “Mã của bạn (hết hạn sau 15 phút):”. Mã có dạng RD- và 6 ký tự.",
          "Mở Zalo trên điện thoại bằng tài khoản Zalo của bạn.",
          "Gửi đúng mã đó vào khung chat với Zalo OA của công ty trong vòng 15 phút.",
          "Tải lại trang và kiểm tra dòng trạng thái đã đổi thành **Đã liên kết Zalo**.",
        ],
        result:
          "Từ đó tin nhắc việc và tin báo gia hạn gửi cho bạn qua cả email và Zalo. Muốn thôi nhận qua Zalo, bấm **Gỡ liên kết**; trang báo “Đã gỡ liên kết Zalo.”.",
      },
    ],
    terms: [
      {
        term: "**Đang mở**",
        meaning:
          "Việc chưa làm xong và chưa bị hủy. Chỉ việc đang mở mới được nhắc.",
      },
      {
        term: "**Đã xong**",
        meaning:
          "Việc đã được đánh dấu hoàn thành. Thẻ ghi **Xong lúc** kèm ngày giờ.",
      },
      {
        term: "**Đã hủy**",
        meaning: "Việc không làm nữa, có ghi lý do. Không mở lại được.",
      },
      {
        term: "**Quá hạn**",
        meaning:
          "Chữ đỏ trước ngày hạn (ngày ghi theo dạng năm-tháng-ngày, ví dụ 2026-09-10): đã qua hết ngày hạn (sau 23 giờ 59 theo giờ Việt Nam) mà việc vẫn đang mở.",
      },
      {
        term: "**Hôm nay**",
        meaning: "Chữ vàng trước ngày hạn: hạn là cuối ngày hôm nay.",
      },
      {
        term: "**Không hạn**",
        meaning: "Việc không đặt ngày hạn. Việc không hạn không có nhắc việc.",
      },
      {
        term: "**Chưa gán**",
        meaning: "Việc chưa có người làm. Việc chưa gán không có nhắc việc.",
      },
      {
        term: "Dấu “!” màu đỏ",
        meaning: "Việc có mức **Ưu tiên** là **Cao**.",
      },
      {
        term: "**Bước**",
        meaning:
          "Số bước trong quy trình đơn hàng mà việc này thuộc về, với các việc tạo từ kế hoạch đơn hàng.",
      },
      {
        term: "**Từ đề xuất AI**",
        meaning: "Việc được tạo khi bạn duyệt một đề xuất của Trợ lý AI.",
      },
      {
        term: "**Xin dời sang**",
        meaning:
          "Trên thẻ việc: người làm đang xin dời hạn tới ngày này. Bấm vào dòng chữ để nhảy lên khung **Xin gia hạn chờ duyệt**.",
      },
      {
        term: "Chữ tiếng Anh trong ngoặc sau tên người",
        meaning:
          "Ở ô **Người làm** và trong đề xuất của trợ lý, vị trí của mỗi người hiện bằng tên tiếng Anh: DIRECTOR là Giám đốc, WAREHOUSE_MANAGER là Thủ kho / Quản lý kho, FACTORY_MANAGER là Quản lý nhà máy, FACTORY_ACCOUNTANT là Kế toán nhà máy & mua hàng, COMPANY_ACCOUNTANT là Kế toán công ty, CONTENT_CREATOR là Biên tập nội dung.",
      },
      {
        term: "**Giả định**",
        meaning:
          "Những điều trợ lý tự cho là đúng khi soạn đề xuất. Con số trong ngoặc là số giả định. Bấm vào để mở danh sách và đọc trước khi duyệt.",
      },
      {
        term: "**Chế độ gửi**: off, test, live",
        meaning:
          "off: hệ thống ghi nhận nhắc việc nhưng không gửi đi, mọi dòng thành **Bỏ qua**. test: email được chuyển tới một địa chỉ thử nghiệm, không tới người thật, còn tin Zalo bị bỏ qua. live: gửi thật cho từng người.",
      },
      {
        term: "**Lịch tự động: đã cấu hình**",
        meaning:
          "Nhắc việc tự chạy mỗi ngày một lần vào khoảng 8 giờ sáng giờ Việt Nam. Nếu thấy **Lịch tự động: chưa cấu hình (chỉ chạy bằng tay)** thì phải bấm **Chạy nhắc việc ngay**.",
      },
      {
        term: "Các loại nhắc việc",
        meaning:
          "Mặc định hệ thống nhắc người làm 1 ngày trước hạn, đúng ngày hạn, và mỗi ngày một lần sau khi quá hạn, cho đến khi việc xong, bị hủy hoặc được dời hạn.",
      },
      {
        term: "email, zalo (cột thứ hai của bảng nhắc việc)",
        meaning:
          "Kênh gửi tin. Mỗi tin luôn gửi qua email; nếu người nhận đã liên kết Zalo thì có thêm một dòng zalo.",
      },
      {
        term: "taskDueSoon, taskDue, taskOverdue",
        meaning:
          "Loại tin nhắc, hiện bằng tiếng Anh: taskDueSoon là sắp đến hạn, taskDue là đến hạn hôm nay, taskOverdue là đã quá hạn.",
      },
      {
        term: "taskAssigned, taskExtensionRequested, taskExtensionDecided",
        meaning:
          "Loại tin báo, hiện bằng tiếng Anh: taskAssigned là báo có việc mới hoặc việc vừa đổi hạn, đổi người; taskExtensionRequested là báo cho bạn có người xin gia hạn; taskExtensionDecided là báo cho người xin biết câu trả lời của bạn.",
      },
      {
        term: "**Chờ gửi**, **Đang gửi**",
        meaning: "Tin đang nằm trong hàng chờ hoặc đang được gửi đi.",
      },
      {
        term: "**Nhà cung cấp đã nhận**",
        meaning:
          "Dịch vụ email hoặc Zalo đã nhận tin để chuyển đi. Điều này không có nghĩa là người nhận đã đọc.",
      },
      {
        term: "**Lỗi, sẽ thử lại**",
        meaning:
          "Lần gửi vừa rồi bị lỗi. Tin được hẹn thử lại sau một khoảng chờ tăng dần (5 phút, 15 phút, 1 giờ, 4 giờ, 12 giờ), nhưng chỉ thật sự gửi lại khi hệ thống chạy gửi tin lần kế tiếp: lịch tự động hằng ngày, khi bạn bấm **Chạy nhắc việc ngay**, hoặc khi có một tin báo mới được gửi.",
      },
      {
        term: "**Thất bại hẳn**",
        meaning:
          "Không gửi được và hệ thống không tự thử nữa: lỗi thuộc loại không thử lại được, hoặc đã thử quá số lần. Bấm **Gửi lại** nếu muốn gửi tiếp.",
      },
      {
        term: "**Bỏ qua**",
        meaning:
          "Tin không được gửi, ví dụ vì việc đã xong, đã đổi người làm hoặc đã đổi hạn trước lúc gửi, vì **Chế độ gửi** đang là off, hoặc vì Zalo chưa sẵn sàng. Lý do ghi ở dòng chữ xám bên dưới.",
      },
      {
        term: "Dòng chữ xám dưới trạng thái",
        meaning:
          "Lý do lỗi hoặc lý do bỏ qua, ghi bằng mã tiếng Anh. Hay gặp: DELIVERY_OFF (chế độ gửi đang off), TASK_CLOSED (việc đã xong hoặc đã hủy), TASK_REASSIGNED (việc đã đổi người làm), TASK_RESCHEDULED (hạn đã đổi), TASK_NO_DEADLINE (việc không còn hạn), RECIPIENT_INACTIVE (người nhận không còn làm việc), INVALID_RECIPIENT (địa chỉ email không dùng được), ZALO_NOT_CONFIGURED (Zalo chưa cài trên máy chủ), ZALO_NOT_LINKED (người nhận chưa liên kết Zalo), TEST_MODE_EMAIL_ONLY (chế độ test chỉ gửi email), EXTENSION_DECIDED (yêu cầu gia hạn đã được trả lời trước lúc gửi).",
      },
      {
        term: "Mũi tên “→” kèm địa chỉ sau trạng thái",
        meaning:
          "Tin đã được chuyển tới địa chỉ thử nghiệm thay vì người nhận thật (khi **Chế độ gửi** là test).",
      },
      {
        term: "Zalo OA",
        meaning:
          "Tài khoản Zalo chính thức (Official Account) của công ty, dùng để gửi tin nhắc việc qua Zalo.",
      },
      {
        term: "**Đã liên kết Zalo**, **Chưa liên kết**",
        meaning:
          "Cho biết tài khoản của bạn đã được nối với Zalo cá nhân của bạn hay chưa.",
      },
    ],
    tips: [
      {
        text: "Tin báo cho người được giao gửi ngay khi bạn lưu, không chờ lịch nhắc hằng ngày. Riêng ban đêm (mặc định từ 21 giờ đến 7 giờ sáng) tin được giữ lại và gửi vào buổi sáng.",
      },
      {
        text: "Luôn đặt hạn cho việc quan trọng: việc **Không hạn** hoặc **Chưa gán** sẽ không bao giờ được nhắc.",
      },
      {
        text: "Muốn đổi hạn theo lời xin của nhân viên, hãy dùng **Duyệt gia hạn** thay vì tự sửa ô **Hạn (ngày)**, để người xin nhận được câu trả lời rõ ràng.",
      },
      {
        text: "Đánh dấu **Xong** hoặc **Hủy** một việc đang có yêu cầu xin gia hạn thì yêu cầu đó tự được gỡ khỏi khung **Xin gia hạn chờ duyệt**.",
      },
      {
        text: "Từ chối đề xuất của trợ lý mà bỏ trống lý do sẽ báo lỗi “Dữ liệu nhập chưa hợp lệ.”. Hãy nhập lý do rồi bấm lại.",
      },
      {
        text: "“Bản ghi đã thay đổi; trang đã tải lại, kiểm tra rồi thử lại.”: trong lúc bạn đang xem, người khác vừa thay đổi việc này (ví dụ người làm vừa bấm xong hoặc vừa xin gia hạn). Đọc lại thẻ việc rồi làm lại.",
      },
      {
        text: "“Không tìm thấy đơn hàng với mã này.”: mã đơn nhập sai. Kiểm tra lại mã trong **Sổ đơn hàng**. “Đơn hàng đã đóng hoặc đã hủy.”: không gắn việc mới vào đơn này được.",
      },
      {
        text: "“Người được gán không phải tài khoản đang hoạt động.”: người bạn chọn vừa bị khoá hoặc chưa được duyệt. Kiểm tra ở **Danh sách nhân sự**.",
      },
      {
        text: "“Yêu cầu gia hạn đã được xử lý trước đó.”: yêu cầu này đã được trả lời, hoặc đã tự gỡ vì việc vừa được sửa, đánh dấu xong hoặc hủy. Tải lại trang để xem.",
      },
      {
        text: "Với việc **Chưa gán**, ô **Người làm** trong **Sửa việc** không để trống được và tự chọn sẵn người đầu danh sách. Hãy chọn đúng người trước khi bấm **Lưu thay đổi**.",
      },
      {
        text: "“Đơn hàng đã thay đổi sau khi đề xuất; hãy yêu cầu trợ lý lập kế hoạch mới.” và “Kế hoạch không còn hợp lệ (hạn đã qua hoặc phụ thuộc sai); hãy lập lại.”: đề xuất đã cũ, hãy nhờ Trợ lý AI soạn lại.",
      },
      {
        text: "Dòng “Zalo OA chưa được cấu hình trên máy chủ; mã có thể lấy nhưng chưa xác minh được.” nghĩa là phần cài đặt kỹ thuật cho Zalo chưa xong, tin Zalo chưa gửi được. Hãy báo người phụ trách kỹ thuật; khi cài xong, bạn kết nối Zalo OA một lần ở mục **Thiết lập**.",
      },
      {
        text: "Mã liên kết Zalo chỉ dùng được trong 15 phút. Hết hạn thì bấm **Lấy mã liên kết** để lấy mã mới.",
      },
    ],
  },
  {
    path: "/approvals",
    title: "Phê duyệt",
    summary:
      "Bàn quyết định của Giám đốc: các nghiệp vụ trọng yếu được trình lên và nằm chờ ở đây cho đến khi bạn **Phê duyệt** hoặc **Từ chối**. Trang cũng có bảng tra cứu các loại nghiệp vụ cần Giám đốc duyệt.",
    layout: [
      {
        text: "Phần đầu trang có dòng **Cổng phê duyệt**, tiêu đề “Giám đốc duyệt bán hàng và chi trả”, lời giải thích, và câu nhấn mạnh: “Xác nhận đơn hàng, mua vật tư, thanh toán cơ sở, bán hàng tại xưởng, bán nguyên liệu.”",
      },
      {
        text: "Dải thông báo sau khi bạn quyết định: màu vàng “Đã ghi nhận quyết định.”, hoặc màu đỏ bắt đầu bằng “Không ghi nhận được quyết định:” khi có lỗi.",
      },
      {
        text: "Khung **Hàng đợi đang chờ quyết định**: mỗi yêu cầu là một thẻ gồm loại phê duyệt, thời điểm **Trình lúc**, một dòng tóm tắt, ô **Lý do (bắt buộc khi từ chối)** và hai nút **Phê duyệt**, **Từ chối**. Yêu cầu trình sớm nhất nằm trên cùng.",
      },
      {
        text: "Khung **Mẫu tem chờ duyệt** chỉ hiện khi có đơn dùng mẫu tem công ty mà bạn chưa duyệt: mỗi dòng gồm mã đơn · tên khách (bấm để mở đơn) và ngày tải mẫu lên.",
      },
      {
        text: "Bảng **Danh mục các loại phê duyệt** với hai cột **Nội dung cần duyệt** và **Quyền quyết định**, liệt kê mọi loại nghiệp vụ phải qua Giám đốc.",
      },
      {
        text: "Khung **Tách bạch trách nhiệm** ở cuối trang nhắc lại các quy tắc khi duyệt.",
      },
    ],
    capabilities: [
      {
        text: "Xem mọi yêu cầu đang chờ quyết định, kèm thời điểm trình và dòng tóm tắt.",
      },
      {
        text: "Phê duyệt một yêu cầu bằng nút **Phê duyệt**. Ô lý do có thể để trống khi phê duyệt.",
      },
      {
        text: "Từ chối một yêu cầu bằng nút **Từ chối**, bắt buộc ghi lý do.",
      },
      {
        text: "Tìm các đơn có mẫu tem công ty chờ duyệt trong khung **Mẫu tem chờ duyệt**, mở đơn và bấm **Duyệt mẫu tem này** trong thẻ **Mẫu tem & shipping mark**.",
      },
      {
        text: "Tra cứu trong **Danh mục các loại phê duyệt** xem những nghiệp vụ nào phải có quyết định của Giám đốc.",
      },
    ],
    limits: [
      {
        text: "Không tạo yêu cầu phê duyệt ở trang này. Người phụ trách bấm nút **Trình Giám đốc phê duyệt** trên trang chi tiết đơn hàng trong **Sổ đơn hàng**.",
      },
      {
        text: "Đơn hàng gửi yêu cầu vào hàng đợi ở hai bước: bước 1 (**Xác nhận đơn hàng**) và bước 4 (**Mua nguyên liệu**). Hợp đồng cơ sở có giá cao hơn giá cũ (**Giá mua hợp đồng cơ sở cao hơn giá cũ**) và đề nghị thanh toán cho cơ sở (**Thanh toán cho cơ sở**) được trình từ mục Hợp đồng cơ sở. Bán hàng tại xưởng và bán nguyên liệu chưa có nơi trình nên chưa xuất hiện trong hàng đợi.",
      },
      {
        text: "Mẫu tem công ty không nằm trong hàng đợi và không có nút **Từ chối**: bạn duyệt ngay trên trang đơn. Không đồng ý thì báo người ghi đơn sửa và tải mẫu mới lên.",
      },
      {
        text: "Bạn không quyết định được yêu cầu do chính bạn trình, kể cả khi bạn là Giám đốc.",
      },
      {
        text: "Quyết định đã ghi nhận thì không đổi được. Yêu cầu biến mất khỏi hàng đợi ngay sau khi bạn bấm.",
      },
      {
        text: "Trang không hiện danh sách các yêu cầu đã duyệt hoặc đã từ chối trước đây.",
      },
      {
        text: "Bảng **Danh mục các loại phê duyệt** chỉ để tra cứu, không bấm được.",
      },
    ],
    flows: [
      {
        title: "Phê duyệt một yêu cầu",
        when: "Khi có yêu cầu mới trong **Hàng đợi đang chờ quyết định**, ví dụ một đơn hàng đang ở bước chờ Giám đốc duyệt.",
        steps: [
          "Mở mục **Phê duyệt** trên menu.",
          "Đọc tên loại phê duyệt ở đầu thẻ, ví dụ **Xác nhận đơn hàng**.",
          "Đọc dòng tóm tắt để biết mã đơn và tên khách.",
          "Mở **Sổ đơn hàng** và kiểm tra đơn đó nếu cần xem kỹ giá hoặc điều khoản.",
          "Nhập ghi chú vào ô **Lý do (bắt buộc khi từ chối)** nếu muốn lưu lại ý kiến.",
          "Bấm **Phê duyệt**.",
        ],
        result:
          "Trang báo “Đã ghi nhận quyết định.” và thẻ rời khỏi hàng đợi. Trên trang chi tiết đơn hàng, khung **Phê duyệt của Giám đốc** hiện “Đã được phê duyệt và còn hiệu lực.”. Đơn không tự chuyển bước: người phụ trách bước đó chuyển bước trên trang đơn. Hệ thống không gửi email hay Zalo về quyết định này.",
        links: ["/approvals", "/orders"],
      },
      {
        title: "Duyệt mẫu tem công ty",
        when: "Khi khung **Mẫu tem chờ duyệt** có đơn: khách không gửi mẫu tem, shipping mark nên đơn dùng mẫu công ty.",
        steps: [
          "Trong khung **Mẫu tem chờ duyệt**, bấm vào mã đơn để mở đơn.",
          "Kéo tới thẻ **Mẫu tem & shipping mark** và bấm tên tệp trong ô **Mẫu tem, shipping mark theo mẫu công ty** để xem mẫu.",
          "Nếu mẫu đúng, bấm **Duyệt mẫu tem này** dưới tệp mới nhất.",
        ],
        result:
          "Trang đơn báo “Đã duyệt mẫu tem.”, nhãn trạng thái đổi thành “Mẫu công ty đã được Giám đốc duyệt ngày …” và đơn biến mất khỏi khung **Mẫu tem chờ duyệt**. Nếu sau đó có người tải mẫu công ty mới, mẫu mới lại chờ bạn duyệt.",
      },
      {
        title: "Từ chối một yêu cầu",
        when: "Khi bạn không đồng ý với nội dung được trình, hoặc trang đơn hàng báo yêu cầu đang chờ được tạo trên phiên bản cũ của đơn.",
        steps: [
          "Tìm thẻ yêu cầu trong **Hàng đợi đang chờ quyết định**.",
          "Nhập lý do từ chối rõ ràng vào ô **Lý do (bắt buộc khi từ chối)**.",
          "Bấm **Từ chối**.",
        ],
        result:
          "Trang báo “Đã ghi nhận quyết định.”, thẻ rời khỏi hàng đợi và lý do được lưu cùng quyết định. Đơn hàng vẫn đứng ở bước cần duyệt, và nút **Trình Giám đốc phê duyệt** hiện lại trên trang đơn để người phụ trách trình lại sau khi sửa. Lý do từ chối không hiện cho người trình và hệ thống không gửi tin báo, nên hãy báo trực tiếp cho họ.",
      },
    ],
    terms: [
      {
        term: "**Xác nhận đơn hàng**",
        meaning:
          "Trình ở bước 1 của đơn hàng “Giám đốc xác nhận đơn hàng”. Phải được duyệt thì đơn mới sang bước xác nhận mẫu & kỹ thuật.",
      },
      {
        term: "**Mua nguyên liệu**",
        meaning:
          "Trình ở bước 4 “Đặt mua vật tư” của đơn hàng, vì mua là chi trả.",
      },
      {
        term: "Các loại khác trong danh mục",
        meaning:
          "Ví dụ **Kế hoạch sản xuất**, **Xuất hàng**, **Giá bán của đơn hàng**, **Hủy đơn hàng**, **Gửi báo giá cho khách**, **Thay đổi đơn giá nhà cung cấp**, **Tạm ứng cho nhà cung cấp**, **Chi phí phát sinh**, **Điều chỉnh tồn kho**, **Duyệt mẫu**, **Xuất bản nội dung website**, **Xuất bản bộ sưu tập**, **Xác nhận lương**: các loại đã được định nghĩa nhưng hiện chưa có màn hình nào trình lên hàng đợi. Kế hoạch sản xuất và xuất hàng không còn cần duyệt theo quy trình mới.",
      },
      {
        term: "**Trình lúc**",
        meaning: "Ngày giờ người phụ trách gửi yêu cầu lên.",
      },
      {
        term: "Dòng tóm tắt",
        meaning:
          "Với đơn hàng, dòng này gồm mã đơn, tên khách hàng và tên bước hiện tại của đơn (tên bước hiện bằng tiếng Anh). Dòng tóm tắt không bao giờ ghi giá.",
      },
      {
        term: "Chữ nhỏ màu xám cạnh tên loại phê duyệt",
        meaning:
          "Tên nội bộ bằng tiếng Anh của loại phê duyệt. Bạn chỉ cần đọc tên tiếng Việt.",
      },
      {
        term: "**Quyền quyết định**",
        meaning:
          "Cột trong bảng danh mục, ghi tên nội bộ (tiếng Anh) của quyền cần có để quyết định loại đó. Tài khoản Giám đốc giữ tất cả các quyền này.",
      },
      {
        term: "**Tách bạch trách nhiệm**",
        meaning:
          "Người gửi yêu cầu không bao giờ là người duyệt. Từ chối bắt buộc ghi lý do. Nếu hồ sơ gốc thay đổi sau khi duyệt thì phải trình duyệt lại.",
      },
    ],
    tips: [
      {
        text: "Không có email hay Zalo báo khi có yêu cầu mới. Hãy mở mục **Phê duyệt** mỗi ngày.",
      },
      {
        text: "Đừng tự bấm **Trình Giám đốc phê duyệt** trên đơn hàng thay nhân viên: yêu cầu do chính bạn trình sẽ báo lỗi “Người trình không thể tự quyết định yêu cầu của mình.” và bạn không duyệt được.",
      },
      {
        text: "Phê duyệt chỉ có hiệu lực với đơn hàng đúng như lúc trình. Nếu đơn bị sửa sau khi trình, trang đơn hàng báo “Yêu cầu đang chờ được tạo trên phiên bản cũ của đơn — sau khi Giám đốc từ chối hoặc xử lý, hãy trình lại.” hoặc “Đã có phê duyệt nhưng đơn hàng đã thay đổi sau đó — phải trình duyệt lại.”. Hàng đợi ở trang này không báo điều đó, nên khi nghi đơn đã bị sửa, hãy mở đơn trong **Sổ đơn hàng** trước khi bấm.",
      },
      {
        text: "“Từ chối bắt buộc phải ghi lý do.”: bạn bấm **Từ chối** khi ô lý do còn trống. Nhập lý do rồi bấm lại.",
      },
      {
        text: "Trên trang đơn, dòng “Mẫu này do bạn tải lên nên bạn không tự duyệt được.” thay cho nút **Duyệt mẫu tem này**: đừng tự tải mẫu tem công ty lên thay nhân viên nếu muốn duyệt nó.",
      },
      {
        text: "“Yêu cầu đã được quyết định trước đó.”: yêu cầu này đã có quyết định, thường do bạn bấm hai lần hoặc mở trang ở hai cửa sổ. Tải lại trang.",
      },
      {
        text: "“Không tìm thấy yêu cầu.” hoặc “Hệ thống tạm thời không phản hồi.”: tải lại trang và thử lại sau ít phút.",
      },
      {
        text: "Hàng đợi trống hiện dòng “Không có yêu cầu nào đang chờ trong phạm vi của bạn.” nghĩa là hiện chưa có ai trình yêu cầu nào.",
      },
    ],
  },
  {
    path: "/organization",
    title: "Cơ cấu tổ chức",
    summary:
      "Trang tra cứu, chỉ để đọc: mô tả từng vị trí trong công ty, role được cấp, trách nhiệm, dữ liệu phụ trách, quy tắc xem giá và danh sách biểu mẫu công ty đang dùng.",
    layout: [
      {
        text: "Phần đầu trang có dòng **Cơ cấu tổ chức**, tiêu đề “Vị trí, trách nhiệm và dữ liệu phụ trách” và lời giải thích: hệ thống mô tả vị trí công việc chứ không gắn cứng tên người.",
      },
      {
        text: "Khung **Quy tắc xem giá** nói ai được xem giá bán, biên lợi nhuận và lợi nhuận.",
      },
      {
        text: "Năm thẻ vị trí: **Giám đốc**, **Kế toán công ty**, **Quản lý nhà máy**, **Kế toán nhà máy**, **Thủ kho / Quản lý kho**. Mỗi thẻ có nhãn role màu vàng, danh sách **Trách nhiệm** và danh sách **Dữ liệu phụ trách**.",
      },
      {
        text: "Bảng **Biểu mẫu đang dùng tại công ty** với ba cột **Biểu mẫu**, **Vị trí phụ trách** và **Trạng thái**.",
      },
    ],
    capabilities: [
      {
        text: "Xem mỗi vị trí gồm những trách nhiệm nào và phải giữ cho dữ liệu nào luôn đúng.",
      },
      {
        text: "Xem mỗi vị trí được cấp role nào (nhãn màu vàng trên thẻ), để biết khi duyệt người mới cần chọn role gì.",
      },
      {
        text: "Đọc lại quy tắc xem giá: “Lợi nhuận và biên lợi nhuận chỉ Giám đốc được xem. Giá bán chỉ Giám đốc, Kế toán công ty và Kế toán xưởng được xem; tiền khách trả và công nợ khách hàng chỉ Giám đốc và Kế toán công ty. Giá mua và các phần dữ liệu vận hành còn lại thì mọi vị trí đều xem được; quyền chỉnh sửa phải được cấp riêng.”",
      },
      {
        text: "Xem danh sách biểu mẫu giấy công ty đang dùng, vị trí phụ trách từng biểu mẫu và tình trạng đưa lên hệ thống.",
      },
    ],
    limits: [
      {
        text: "Trang không có nút nào: không sửa được trách nhiệm, không thêm vị trí, không đổi biểu mẫu. Nội dung do bên phát triển hệ thống cập nhật theo yêu cầu đã chốt.",
      },
      {
        text: "Trang không cho biết ai đang giữ vị trí nào. Muốn xem hoặc đổi người, dùng mục **Danh sách nhân sự**.",
      },
      {
        text: "Vị trí **Biên tập nội dung** không có thẻ riêng trên trang này, dù role **Biên tập nội dung** vẫn chọn được ở **Danh sách nhân sự**.",
      },
    ],
    flows: [
      {
        title: "Tra cứu trách nhiệm của một vị trí",
        when: "Khi phân vân một việc thuộc về ai, hoặc trước khi giao việc cho một người.",
        steps: [
          "Mở mục **Cơ cấu tổ chức** trên menu.",
          "Tìm thẻ có tên vị trí cần xem.",
          "Đọc danh sách **Trách nhiệm**.",
          "Đọc danh sách **Dữ liệu phụ trách** để biết vị trí đó phải cập nhật dữ liệu nào.",
        ],
        result:
          "Bạn biết việc hoặc dữ liệu đó thuộc vị trí nào, rồi giao việc ở mục **Giao việc** cho đúng người.",
        links: ["/organization", "/tasks"],
      },
      {
        title: "Bàn giao một vị trí cho người khác",
        when: "Khi một người nghỉ, người mới vào, hoặc một người tạm làm thay vị trí khác.",
        steps: [
          "Mở mục **Cơ cấu tổ chức**.",
          "Xem nhãn role màu vàng trên thẻ của vị trí cần bàn giao.",
          "Mở mục **Danh sách nhân sự**.",
          "Chọn đúng role đó ở cột **Role** trên dòng của người nhận bàn giao.",
          "Bấm **Duyệt** nếu đó là người mới, hoặc **Lưu role** nếu người đó đang làm việc.",
          "Đổi role hoặc bấm **Khoá** với người rời vị trí.",
        ],
        result:
          "Người nhận có quyền của vị trí từ lần tải trang kế tiếp. Không cần sửa gì trên trang **Cơ cấu tổ chức**.",
        links: ["/organization", "/staff"],
      },
    ],
    terms: [
      {
        term: "Vị trí",
        meaning:
          "Một chỗ làm việc trong công ty với trách nhiệm cố định, không gắn với tên người. Người nào được cấp role của vị trí thì làm vị trí đó.",
      },
      {
        term: "Nhãn role màu vàng",
        meaning:
          "Role cấp cho người giữ vị trí. Tên role giống tên trong ô chọn role ở **Danh sách nhân sự**; ví dụ thẻ **Kế toán nhà máy** có nhãn “Kế toán nhà máy & mua hàng”.",
      },
      {
        term: "**Trách nhiệm**",
        meaning:
          "Các mảng việc vị trí đó chịu trách nhiệm, theo sơ đồ tổ chức đã chốt.",
      },
      {
        term: "**Dữ liệu phụ trách**",
        meaning: "Các loại thông tin vị trí đó phải nhập và giữ cho đúng.",
      },
      {
        term: "**Mới có định nghĩa**",
        meaning:
          "Biểu mẫu mới được ghi nhận tên, vị trí phụ trách và quyền cần có; chưa có màn hình riêng theo đúng biểu mẫu đó.",
      },
      {
        term: "**Đã có màn hình**",
        meaning:
          "Biểu mẫu đã có màn hình để nhập và lưu. Hiện bảng chưa có dòng nào ở trạng thái này.",
      },
      {
        term: "Chữ nhỏ màu xám dưới tên biểu mẫu",
        meaning:
          "Tên nội bộ bằng tiếng Anh của quyền cần có để dùng biểu mẫu. Bạn không cần quan tâm tới dòng này.",
      },
    ],
    tips: [
      {
        text: "Cột **Trạng thái** là nội dung cố định, không tự đổi khi có màn hình mới. Ví dụ mục **Theo dõi tiến độ mẫu** đã có trên menu nhưng dòng **Form tiến độ mẫu** vẫn ghi **Mới có định nghĩa**. Muốn biết một việc đã làm được trên hệ thống chưa, hãy xem menu.",
      },
      {
        text: "Mỗi người chỉ giữ một role. Nhãn role trên thẻ vị trí chính là role bạn chọn cho người đó ở **Danh sách nhân sự**.",
      },
    ],
  },
  {
    path: "/staff",
    title: "Danh sách nhân sự",
    summary:
      "Nơi bạn duyệt người mới đăng nhập bằng Gmail, chọn một role cho mỗi người, đổi role, khoá và mở khoá tài khoản. Ai đăng nhập lần đầu sẽ nằm ở **Chờ duyệt** cho đến khi bạn duyệt.",
    layout: [
      {
        text: "Phần đầu trang có dòng **Nhân sự**, tiêu đề **Danh sách nhân sự** và lời giải thích ngắn.",
      },
      {
        text: "Dải thông báo sau mỗi thao tác: màu vàng khi thành công, màu đỏ bắt đầu bằng “Thao tác không thành công:” khi có lỗi.",
      },
      {
        text: "Ba nút thẻ trạng thái kèm số lượng trong ngoặc: **Chờ duyệt**, **Đang làm việc**, **Đã khoá**. Khi mở trang, nếu có người đang chờ thì trang mở sẵn thẻ **Chờ duyệt**, nếu không thì mở **Đang làm việc**.",
      },
      {
        text: "Bảng tài khoản với các cột **Tên**, **Gmail**, **Role**, cột thời gian và **Thao tác**. Cột thời gian đổi theo thẻ: **Đăng nhập lúc** (Chờ duyệt), **Đăng nhập lần cuối** (Đang làm việc), **Khoá lúc** (Đã khoá).",
      },
      {
        text: "Ở thẻ **Chờ duyệt**, người đăng nhập gần nhất nằm trên cùng. Ở hai thẻ còn lại, danh sách xếp theo tên từ A đến Z.",
      },
      {
        text: "Nút **Từ chối** và **Khoá** không làm ngay: bấm vào sẽ mở một khung nhỏ màu đỏ giải thích hậu quả, kèm nút xác nhận.",
      },
    ],
    capabilities: [
      {
        text: "Duyệt người mới: chọn role trong ô **Chọn role…** rồi bấm **Duyệt**.",
      },
      {
        text: "Từ chối người mới: bấm **Từ chối** rồi **Xác nhận từ chối**. Tài khoản chờ duyệt bị xoá.",
      },
      {
        text: "Đổi role của người đang làm việc: chọn role mới trong cột **Role** rồi bấm **Lưu role**.",
      },
      {
        text: "Khoá tài khoản đang làm việc: bấm **Khoá** rồi **Xác nhận khoá**. Role được giữ lại.",
      },
      {
        text: "Mở khoá tài khoản ở thẻ **Đã khoá** bằng nút **Mở khoá**. Người đó có lại đúng role cũ.",
      },
      {
        text: "Chọn một trong năm role: **Quản lý nhà máy**, **Thủ kho / Quản lý kho**, **Kế toán nhà máy & mua hàng**, **Kế toán công ty**, **Biên tập nội dung**.",
      },
      {
        text: "Xem Gmail, tên và thời điểm đăng nhập của từng người để nhận ra đúng người trước khi duyệt.",
      },
    ],
    limits: [
      {
        text: "Không cấp role **Giám đốc** ở đây. Công ty chỉ có một Giám đốc, role này không có trong ô chọn.",
      },
      {
        text: "Không thao tác được trên tài khoản của chính bạn (dòng ghi **Tài khoản của bạn**) và trên tài khoản Giám đốc (dòng ghi **Giám đốc**).",
      },
      {
        text: "Mỗi người chỉ giữ một role. Không có tùy chọn bật tắt từng màn hình cho riêng một người.",
      },
      {
        text: "Không tạo tài khoản thay người khác và không mời bằng email. Người mới phải tự đăng nhập bằng Gmail một lần để hiện trong **Chờ duyệt**.",
      },
      {
        text: "Không có đăng nhập bằng số điện thoại, mã OTP hay mật khẩu; chỉ đăng nhập bằng Gmail.",
      },
      {
        text: "**Từ chối** không chặn vĩnh viễn: nếu người đó đăng nhập lại, họ quay lại hàng chờ. Muốn chặn một người đang làm việc, hãy dùng **Khoá**.",
      },
      {
        text: "Hệ thống không gửi thông báo cho người được duyệt, đổi role, khoá hay mở khoá.",
      },
    ],
    flows: [
      {
        title: "Duyệt người mới vào hệ thống",
        when: "Khi một nhân viên báo đã đăng nhập bằng Gmail, hoặc trang **Tổng quan** báo có người đang chờ duyệt.",
        steps: [
          "Mở mục **Danh sách nhân sự** trên menu.",
          "Bấm thẻ **Chờ duyệt**.",
          "Kiểm tra cột **Tên** và **Gmail** để chắc chắn đúng người.",
          "Xem thẻ vị trí ở mục **Cơ cấu tổ chức** nếu chưa chắc nên chọn role nào.",
          "Chọn role trong ô **Chọn role…** ở cột **Role**.",
          "Bấm **Duyệt**.",
          "Báo người đó tải lại trang.",
        ],
        result:
          "Trang báo “Đã duyệt tài khoản.”, người đó chuyển sang thẻ **Đang làm việc**. Màn hình “Tài khoản đang chờ Giám đốc duyệt” của họ biến mất khi họ tải lại trang, và họ thấy menu theo role vừa chọn.",
        links: ["/staff", "/organization"],
      },
      {
        title: "Từ chối người đăng nhập nhầm",
        when: "Khi trong **Chờ duyệt** có Gmail lạ, hoặc nhân viên đăng nhập nhầm Gmail cá nhân.",
        steps: [
          "Bấm thẻ **Chờ duyệt**.",
          "Tìm dòng cần từ chối.",
          "Bấm **Từ chối** ở cột **Thao tác**.",
          "Đọc dòng giải thích trong khung màu đỏ.",
          "Bấm **Xác nhận từ chối**.",
        ],
        result:
          "Trang báo “Đã từ chối. Nếu người này đăng nhập lại, họ sẽ quay lại hàng chờ.”. Dòng đó biến mất khỏi danh sách.",
      },
      {
        title: "Đổi role của một người",
        when: "Khi một người chuyển sang vị trí khác, hoặc bạn chọn nhầm role lúc duyệt.",
        steps: [
          "Bấm thẻ **Đang làm việc**.",
          "Tìm dòng của người cần đổi.",
          "Chọn role mới trong ô ở cột **Role**.",
          "Bấm **Lưu role**.",
          "Báo người đó tải lại trang.",
        ],
        result:
          "Trang báo “Đã đổi role. Quyền mới có hiệu lực từ lần tải trang kế tiếp.”. Người đó không cần đăng xuất; lần tải trang tiếp theo họ thấy menu của role mới và mất các màn hình của role cũ.",
      },
      {
        title: "Khoá tài khoản",
        when: "Khi một người nghỉ việc hoặc tạm thời không được vào hệ thống.",
        steps: [
          "Bấm thẻ **Đang làm việc**.",
          "Tìm dòng của người cần khoá.",
          "Bấm **Khoá** ở cột **Thao tác**.",
          "Đọc dòng giải thích trong khung màu đỏ.",
          "Bấm **Xác nhận khoá**.",
        ],
        result:
          "Trang báo “Đã khoá tài khoản.”, người đó chuyển sang thẻ **Đã khoá**. Từ lần tải trang kế tiếp họ chỉ thấy màn hình “Tài khoản đã bị khoá”. Role của họ được giữ lại để mở khoá sau.",
      },
      {
        title: "Mở khoá tài khoản",
        when: "Khi người bị khoá được quay lại làm việc.",
        steps: [
          "Bấm thẻ **Đã khoá**.",
          "Tìm dòng của người cần mở khoá.",
          "Kiểm tra role ở cột **Role**; nếu cột hiện ô chọn, chọn role cho người đó.",
          "Bấm **Mở khoá**.",
          "Báo người đó tải lại trang.",
        ],
        result:
          "Trang báo “Đã mở khoá tài khoản.”, người đó quay về thẻ **Đang làm việc** với role đã giữ. Muốn đổi role, hãy mở khoá trước rồi dùng **Lưu role**.",
      },
    ],
    terms: [
      {
        term: "**Chờ duyệt**",
        meaning:
          "Người đã đăng nhập bằng Gmail nhưng chưa được duyệt. Họ chỉ thấy màn hình “Tài khoản đang chờ Giám đốc duyệt”.",
      },
      {
        term: "**Đang làm việc**",
        meaning: "Tài khoản đã được duyệt, dùng hệ thống theo role của mình.",
      },
      {
        term: "**Đã khoá**",
        meaning:
          "Tài khoản bị chặn truy cập nhưng vẫn giữ role. Người đó thấy màn hình “Tài khoản đã bị khoá”.",
      },
      {
        term: "Role",
        meaning:
          "Vai trò của một người trong hệ thống. Role quyết định người đó thấy mục nào trên menu và được làm gì. Mỗi người có đúng một role.",
      },
      {
        term: "**Gmail**",
        meaning:
          "Địa chỉ Gmail người đó dùng để đăng nhập. Đây là cách duy nhất để vào hệ thống.",
      },
      {
        term: "**(chưa có tên)**",
        meaning:
          "Tài khoản Google của người đó không có tên hiển thị. Hãy nhận diện bằng cột **Gmail**.",
      },
      {
        term: "**(bạn)**",
        meaning: "Dòng tài khoản của chính bạn.",
      },
      {
        term: "Nhiều nhãn role trên một dòng",
        meaning:
          "Tài khoản cũ đang giữ nhiều role cùng lúc. Hãy chọn một role duy nhất và lưu để đưa về đúng quy tắc một người một role.",
      },
      {
        term: "**Tài khoản của bạn**, **Giám đốc**",
        meaning:
          "Chữ hiện ở cột **Thao tác** thay cho các nút: dòng đó được bảo vệ, không duyệt, đổi role, khoá hay từ chối được.",
      },
      {
        term: "“—” ở cột thời gian",
        meaning: "Chưa có thông tin, ví dụ người đó chưa từng đăng nhập lại.",
      },
    ],
    tips: [
      {
        text: "Quyền mới áp dụng từ lần tải trang kế tiếp của người đó, không cần đăng xuất. Vì hệ thống không gửi tin báo, hãy nhắn người đó tải lại trang.",
      },
      {
        text: "Trước khi bấm **Duyệt**, luôn đối chiếu cột **Gmail** với nhân viên. Chọn nhầm role cho người lạ là cho họ xem dữ liệu công ty.",
      },
      {
        text: "Nhân viên nghỉ việc thì **Khoá** ngay, không nên để tài khoản ở **Đang làm việc**.",
      },
      {
        text: "“Tài khoản vừa thay đổi ở nơi khác; trang đã tải lại, kiểm tra rồi thử lại.”: tài khoản vừa được thay đổi ở cửa sổ khác. Xem lại dòng đó rồi làm lại.",
      },
      {
        text: "“Hãy chọn một role hợp lệ.”: bạn bấm **Duyệt** hoặc **Lưu role** khi chưa chọn role. “Role không thay đổi.”: role chọn trùng role đang có.",
      },
      {
        text: "“Tài khoản này chưa có role; hãy chọn role trước.”: khi mở khoá, chọn role ở cột **Role** rồi bấm **Mở khoá** lại.",
      },
      {
        text: "“Không tìm thấy tài khoản (có thể đã bị từ chối).”: dòng này đã bị từ chối ở cửa sổ khác. Tải lại trang.",
      },
      {
        text: "“Trạng thái tài khoản không cho phép thao tác này.”: tài khoản đã đổi trạng thái (ví dụ vừa bị khoá). Bấm lại đúng thẻ trạng thái để xem.",
      },
      {
        text: "“Role này chưa được khởi tạo trong hệ thống…”: lỗi cài đặt, hãy báo người phụ trách kỹ thuật.",
      },
    ],
  },
  {
    path: "/quote-requests",
    title: "Yêu cầu báo giá",
    summary:
      "Hộp thư các yêu cầu báo giá khách gửi từ form Liên hệ trên website. Mỗi yêu cầu cũng được gửi tới hộp thư công ty; bạn đọc chi tiết, trả lời khách qua email và đánh dấu tiến độ xử lý ở đây.",
    layout: [
      {
        text: "Phần đầu trang có dòng **Khách hàng**, tiêu đề **Yêu cầu báo giá** và lời giải thích.",
      },
      {
        text: "Hàng nút lọc theo trạng thái: **Tất cả**, **Mới**, **Đang xử lý**, **Đã báo giá**, **Đã đóng**, **Spam**.",
      },
      {
        text: "Danh sách yêu cầu, mỗi dòng có tên khách, công ty, mã yêu cầu, loại yêu cầu, sản phẩm đầu tiên (kèm “+n” nếu nhiều hơn), số sản phẩm, quốc gia, trạng thái, ngày giờ gửi và nút **Mở**. Yêu cầu mới nhất nằm trên cùng.",
      },
      {
        text: "Trang chi tiết (bấm **Mở**): mã yêu cầu làm tiêu đề, nhãn trạng thái, ngày giờ gửi, liên kết **Tất cả yêu cầu** để quay lại danh sách.",
      },
      {
        text: "Trên trang chi tiết có bốn khung: **Nhu cầu**, **Khách hàng** (kèm nút **Trả lời qua email**), **Thông báo email** và **Lịch sử**. Dòng nào khách bỏ trống thì không hiện.",
      },
      {
        text: "Cuối trang chi tiết là khung thao tác: ô **Ghi chú nội bộ (tuỳ chọn)** và các nút đổi trạng thái hợp với trạng thái hiện tại.",
      },
    ],
    capabilities: [
      {
        text: "Lọc danh sách theo trạng thái, hoặc xem **Tất cả**.",
      },
      {
        text: "Mở một yêu cầu để đọc đầy đủ **Nhu cầu**: **Loại yêu cầu**, **Sản phẩm quan tâm** kèm số lượng, **Tổng số lượng dự kiến**, **Ngân sách / giá mục tiêu**, **Thời hạn mong muốn**, **Điều kiện giao hàng**, **Nơi nhận hàng**, **Nội dung**.",
      },
      {
        text: "Xem thông tin **Khách hàng**: **Họ tên**, **Công ty**, **Email**, **Điện thoại**, **Quốc gia**, **Ngôn ngữ khách dùng**.",
      },
      {
        text: "Bấm **Trả lời qua email** để mở chương trình email trên máy với địa chỉ khách và tiêu đề “Re:” kèm mã yêu cầu điền sẵn.",
      },
      {
        text: "Kiểm tra thư tự động đã gửi chưa ở khung **Thông báo email**: **Gửi cho công ty**, **Gửi cho khách**, và **Lỗi gần nhất** nếu có.",
      },
      {
        text: "Đổi trạng thái bằng các nút **Bắt đầu xử lý**, **Đã gửi báo giá**, **Đóng yêu cầu**, **Đánh dấu spam**, **Khôi phục**, có thể kèm ghi chú nội bộ.",
      },
      {
        text: "Xem **Lịch sử** các lần đổi trạng thái, thời điểm và ghi chú nội bộ của từng lần.",
      },
    ],
    limits: [
      {
        text: "Không tạo yêu cầu báo giá bằng tay và không sửa được nội dung khách đã gửi.",
      },
      {
        text: "Không xoá được yêu cầu. Yêu cầu rác thì **Đánh dấu spam**, yêu cầu đã xong thì **Đóng yêu cầu**.",
      },
      {
        text: "Trang không soạn hay gửi báo giá. Nút **Đã gửi báo giá** chỉ ghi nhận tiến độ; bạn gửi báo giá cho khách bằng email của mình.",
      },
      {
        text: "Đổi trạng thái không gửi thư nào cho khách.",
      },
      {
        text: "Trang không tạo khách hàng hay đơn hàng từ yêu cầu. Khi khách đồng ý đặt hàng, việc lập hồ sơ làm ở các mục **Khách hàng** và **Sổ đơn hàng**.",
      },
    ],
    flows: [
      {
        title: "Xem yêu cầu mới",
        when: "Khi hộp thư công ty nhận thư báo có yêu cầu báo giá mới, hoặc khi bạn kiểm tra định kỳ.",
        steps: [
          "Mở mục **Yêu cầu báo giá** trên menu.",
          "Bấm nút lọc **Mới**.",
          "Bấm **Mở** ở dòng cần xem.",
          "Đọc khung **Nhu cầu** và khung **Khách hàng**.",
          "Xem khung **Thông báo email** để biết công ty và khách đã nhận thư tự động chưa.",
        ],
        result:
          "Bạn nắm được khách cần gì. Yêu cầu vẫn ở trạng thái **Mới** cho đến khi bạn bấm một nút đổi trạng thái.",
      },
      {
        title: "Xử lý và trả lời khách",
        when: "Khi bạn bắt đầu làm báo giá cho một yêu cầu.",
        steps: [
          "Mở yêu cầu từ danh sách.",
          "Bấm **Bắt đầu xử lý**.",
          "Bấm **Trả lời qua email** để viết thư cho khách.",
          "Soạn và gửi báo giá trong chương trình email của bạn.",
          "Quay lại trang chi tiết yêu cầu.",
          "Nhập ghi chú vào ô **Ghi chú nội bộ (tuỳ chọn)**, ví dụ giá đã báo hoặc ngày gửi.",
          "Bấm **Đã gửi báo giá**.",
        ],
        result:
          "Sau mỗi lần bấm, khung thao tác hiện “Đã cập nhật.”, nhãn trạng thái đổi sang **Đang xử lý** rồi **Đã báo giá**, và mỗi lần đổi được ghi thêm một dòng trong **Lịch sử**.",
      },
      {
        title: "Đóng yêu cầu",
        when: "Khi khách đã chốt hoặc không phản hồi nữa và không cần theo dõi thêm.",
        steps: [
          "Mở yêu cầu từ danh sách.",
          "Nhập lý do đóng vào ô **Ghi chú nội bộ (tuỳ chọn)**.",
          "Bấm **Đóng yêu cầu**.",
        ],
        result:
          "Yêu cầu chuyển sang **Đã đóng**. Nếu khách liên hệ lại, mở yêu cầu và bấm **Bắt đầu xử lý** để đưa về **Đang xử lý**.",
      },
      {
        title: "Đánh dấu spam hoặc khôi phục",
        when: "Khi yêu cầu là quảng cáo, thư rác hoặc nội dung vô nghĩa, hoặc khi bạn lỡ đánh dấu nhầm.",
        steps: [
          "Mở yêu cầu từ danh sách.",
          "Kiểm tra yêu cầu đang ở **Mới** hoặc **Đang xử lý**; nút **Đánh dấu spam** chỉ hiện ở hai trạng thái này.",
          "Bấm **Đánh dấu spam** ở bên phải khung thao tác.",
          "Nếu đánh dấu nhầm, bấm nút lọc **Spam** trên danh sách.",
          "Bấm **Mở** ở yêu cầu đó.",
          "Bấm **Khôi phục**.",
        ],
        result:
          "Yêu cầu spam nằm riêng ở bộ lọc **Spam**. Khi khôi phục, yêu cầu quay về trạng thái **Mới**.",
      },
    ],
    terms: [
      {
        term: "**Mới**",
        meaning:
          "Yêu cầu khách vừa gửi, chưa ai xử lý. Chữ màu đỏ trên danh sách.",
      },
      {
        term: "**Đang xử lý**",
        meaning: "Công ty đang làm báo giá hoặc đang trao đổi với khách.",
      },
      {
        term: "**Đã báo giá**",
        meaning: "Công ty đã gửi báo giá cho khách.",
      },
      {
        term: "**Đã đóng**",
        meaning: "Yêu cầu đã kết thúc, không cần theo dõi thêm.",
      },
      {
        term: "**Spam**",
        meaning: "Yêu cầu rác, quảng cáo hoặc không phải khách thật.",
      },
      {
        term: "**· chưa gửi mail**",
        meaning:
          "Hiện cạnh yêu cầu **Mới** khi thư báo tới hộp thư công ty chưa gửi được. Hãy mở yêu cầu và xem **Lỗi gần nhất**.",
      },
      {
        term: "Mã yêu cầu",
        meaning:
          "Mã riêng của mỗi yêu cầu, hiện bằng chữ nhỏ sau tên khách và làm tiêu đề trang chi tiết. Dùng mã này khi trao đổi với khách.",
      },
      {
        term: "Các loại yêu cầu",
        meaning:
          "**Sản phẩm có sẵn** (trên trang chi tiết ghi **Báo giá sản phẩm có sẵn**): hỏi giá sản phẩm có trên website. **Thiết kế riêng / OEM**: đặt làm theo mẫu riêng. **Mẫu thử** (trang chi tiết ghi **Đặt mẫu thử**): xin làm mẫu trước. **Xin catalogue**: xin tài liệu giới thiệu sản phẩm. **Khác**: nhu cầu khác.",
      },
      {
        term: "OEM",
        meaning: "Sản xuất theo thiết kế hoặc thương hiệu của khách.",
      },
      {
        term: "Catalogue",
        meaning: "Tài liệu giới thiệu các sản phẩm của công ty.",
      },
      {
        term: "**SL**",
        meaning: "Số lượng khách muốn cho từng sản phẩm.",
      },
      {
        term: "EXW, FOB, CIF, DDP",
        meaning:
          "Điều kiện giao hàng khách chọn. EXW: khách nhận hàng tại xưởng. FOB: công ty giao hàng lên tàu. CIF: giá gồm bảo hiểm và cước vận chuyển. DDP: giao tận nơi, đã gồm thuế. **Chưa xác định**: khách chưa chọn.",
      },
      {
        term: "**Ngôn ngữ khách dùng**",
        meaning:
          "Ngôn ngữ của trang website khách dùng khi gửi, hiện bằng mã hai chữ cái (ví dụ vi là tiếng Việt, en là tiếng Anh). Nên trả lời khách bằng ngôn ngữ này.",
      },
      {
        term: "**Gửi cho công ty**, **Gửi cho khách**",
        meaning:
          "Thư tự động hệ thống gửi khi có yêu cầu: một thư tới hộp thư công ty, một thư xác nhận tới khách. **Đã gửi** kèm giờ là đã gửi, **Chưa gửi** là chưa gửi được.",
      },
      {
        term: "**Lỗi gần nhất**",
        meaning:
          "Chỉ hiện khi thư tự động gặp lỗi: ghi lỗi của lần gửi thư gần nhất. Thường là lý do **Gửi cho công ty** hoặc **Gửi cho khách** còn **Chưa gửi**.",
      },
      {
        term: "Nút đổi trạng thái theo từng trạng thái",
        meaning:
          "**Mới**: **Bắt đầu xử lý**, **Đã gửi báo giá**, **Đóng yêu cầu**, **Đánh dấu spam**. **Đang xử lý**: **Đã gửi báo giá**, **Đóng yêu cầu**, **Đánh dấu spam**. **Đã báo giá**: **Bắt đầu xử lý**, **Đóng yêu cầu**. **Đã đóng**: **Bắt đầu xử lý**. **Spam**: **Khôi phục**.",
      },
      {
        term: "**Lịch sử**",
        meaning:
          "Các lần đổi trạng thái theo thứ tự. Dòng đầu tiên luôn là “Khách gửi → Mới”.",
      },
    ],
    tips: [
      {
        text: "Trả lời thư báo trong hộp thư công ty cũng là trả lời thẳng cho khách, giống như bấm **Trả lời qua email**.",
      },
      {
        text: "Nếu **Gửi cho khách** ghi **Chưa gửi**, khách chưa nhận thư xác nhận tự động. Nên trả lời khách sớm để khách biết công ty đã nhận yêu cầu.",
      },
      {
        text: "Nhớ bấm **Đã gửi báo giá** sau khi gửi thư, để bộ lọc **Mới** và **Đang xử lý** chỉ còn những yêu cầu thật sự chưa trả lời.",
      },
      {
        text: "Ghi chú nội bộ chỉ người trong công ty thấy, khách không nhận được. Ô ghi chú tự trống lại sau khi đổi trạng thái thành công.",
      },
      {
        text: "“Yêu cầu vừa được cập nhật ở nơi khác. Tải lại trang.”: yêu cầu vừa được đổi ở cửa sổ khác. Tải lại trang rồi làm lại.",
      },
      {
        text: "“Trạng thái hiện tại không cho phép thao tác này.”: trạng thái đã đổi so với lúc bạn mở trang. Tải lại trang để thấy đúng các nút.",
      },
      {
        text: "“Không tìm thấy yêu cầu.” hoặc “Không thực hiện được. Thử lại sau.”: tải lại trang và thử lại sau ít phút.",
      },
      {
        text: "Nút đang xử lý hiện chữ “Đang cập nhật…”; chờ chữ “Đã cập nhật.” hiện ra rồi mới bấm tiếp.",
      },
    ],
  },
];
