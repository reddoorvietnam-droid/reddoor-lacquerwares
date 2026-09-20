import type { ScreenGuide } from "../guide-types";

export const commonScreens: readonly ScreenGuide[] = [
  {
    path: "",
    title: "Tổng quan",
    summary:
      "Trang đầu tiên bạn thấy sau khi đăng nhập. Trang chào bạn theo tên và vị trí, rồi xếp sẵn các mục bạn làm việc thành từng thẻ để bấm vào ngay.",
    layout: [
      {
        text: "Khung màu đỏ đậm ở trên cùng: lời chào theo giờ trong ngày (**Chào buổi sáng**, **Chào buổi trưa**, **Chào buổi chiều** hoặc **Chào buổi tối**), rồi tên của bạn bằng chữ lớn.",
      },
      {
        text: "Dưới tên là huy hiệu vị trí của bạn, kèm một câu ngắn nói về công việc của vị trí đó.",
      },
      {
        text: "Phần **Bắt đầu làm việc**: mỗi thẻ là một mục trong menu của bạn, gồm tên mục và một dòng mô tả ngắn. Thẻ đầu tiên luôn là **Hướng dẫn sử dụng website**.",
      },
      {
        text: "Các thẻ của bạn: **Hướng dẫn sử dụng website**, **Trợ lý AI**, **Công việc được giao**, **Giao việc**, **Phê duyệt**, **Cơ cấu tổ chức**, **Danh sách nhân sự**, **Yêu cầu báo giá**.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Các thẻ của bạn: **Hướng dẫn sử dụng website**, **Bảng xuất kho sơn**, **Nguyên vật liệu**, **Hóa đơn bán hàng**, **Công nợ bán sơn**, **Trợ lý AI**, **Công việc được giao**, **Sổ đơn hàng**, **Kiểm tra bảng biểu**.",
        roles: ["WAREHOUSE_MANAGER"],
      },
      {
        text: "Các thẻ của bạn: **Hướng dẫn sử dụng website**, **Trợ lý AI**, **Công việc được giao**, **Sổ đơn hàng**, **Quy trình đơn hàng**, **Kiểm tra bảng biểu**, **Chi phí đơn hàng**.",
        roles: ["FACTORY_MANAGER"],
      },
      {
        text: "Các thẻ của bạn: **Hướng dẫn sử dụng website**, **Trợ lý AI**, **Công việc được giao**, **Sổ đơn hàng**, **Nhà cung cấp**, **Kiểm tra bảng biểu**, **Chi phí đơn hàng**.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Các thẻ của bạn: **Hướng dẫn sử dụng website**, **Hóa đơn bán hàng**, **Công nợ bán sơn**, **Trợ lý AI**, **Công việc được giao**, **Sổ đơn hàng**, **Khách hàng**, **Quy trình đơn hàng**, **Đơn cửa hàng**, **Thiết lập**, rồi các mục tài chính: **Tổng quan tài chính**, **Hóa đơn (INV)**, **Tiền khách trả**, **Công nợ khách hàng**, **Kiểm tra bảng biểu**, **Thu – Chi**, **Chi phí đơn hàng**, **Tỷ giá USD**.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Các thẻ của bạn: **Hướng dẫn sử dụng website**, **Trợ lý AI**, **Công việc được giao**, **Nội dung**, **Theo dõi tiến độ mẫu**, **Sản phẩm**, **Tin tức**, **Bộ sưu tập**, **Cửa hàng**.",
        roles: ["CONTENT_CREATOR"],
      },
      {
        text: "Thẻ **Danh sách nhân sự** có thêm nhãn nhỏ, ví dụ **2 đang chờ duyệt**, khi có người mới đăng nhập bằng Gmail đang chờ bạn duyệt.",
        roles: ["DIRECTOR"],
      },
    ],
    capabilities: [
      {
        text: "Kiểm tra nhanh bạn đang đăng nhập đúng tài khoản và đúng vị trí (tên và huy hiệu vị trí).",
      },
      {
        text: "Bấm một thẻ bất kỳ để mở ngay mục đó, thay cho việc tìm trong menu bên trái.",
      },
      {
        text: "Thấy ngay số người mới đang chờ duyệt trên thẻ **Danh sách nhân sự** và bấm vào để duyệt.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Quay lại trang này bất cứ lúc nào bằng mục **Tổng quan** trong menu.",
      },
    ],
    limits: [
      {
        text: "Trang này không có số liệu, bảng hay nút thao tác nào. Mọi công việc đều làm trong từng mục mà thẻ mở ra.",
      },
      {
        text: "Thẻ chỉ gồm những mục có trong menu của bạn. Bạn không thấy thẻ của mục thuộc vị trí khác. Nếu thiếu mục bạn cần cho công việc, hãy báo Giám đốc.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Trang chỉ có thẻ cho các mục chung và bàn làm việc riêng của Giám đốc. Màn hình của các vị trí khác không có thẻ ở đây; bạn mở chúng từ menu bên trái, nơi các mục được xếp theo từng vị trí.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Tên và vị trí hiển thị không sửa được ở đây. Vị trí của mỗi người do Giám đốc chọn trong **Danh sách nhân sự**.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
    ],
    flows: [
      {
        title: "Bắt đầu một ngày làm việc",
        when: "Mỗi sáng, hoặc mỗi lần mở website.",
        steps: [
          "Đăng nhập bằng tài khoản Gmail công việc của bạn.",
          "Đọc lời chào và kiểm tra huy hiệu có đúng vị trí của bạn không.",
          "Bấm thẻ **Công việc được giao** để xem việc được giao cho bạn và hạn của từng việc.",
          "Quay lại bằng mục **Tổng quan** trong menu.",
          "Bấm thẻ của mục bạn cần làm tiếp.",
        ],
        result:
          "Bạn đã nắm việc cần làm trong ngày và đang ở đúng màn hình để làm việc.",
      },
      {
        title: "Duyệt người mới từ thẻ Danh sách nhân sự",
        when: "Khi thẻ **Danh sách nhân sự** có nhãn **… đang chờ duyệt**.",
        roles: ["DIRECTOR"],
        steps: [
          "Nhìn số trên nhãn để biết có bao nhiêu người đang chờ.",
          "Bấm thẻ **Danh sách nhân sự**.",
          "Duyệt từng người và chọn vị trí cho họ theo phần hướng dẫn của mục **Danh sách nhân sự**.",
          "Bấm **Tổng quan** trong menu để quay lại.",
        ],
        result:
          "Khi không còn ai chờ, nhãn trên thẻ biến mất. Người vừa được duyệt vào được website với menu của vị trí bạn đã chọn.",
      },
      {
        title: "Mở màn hình của một vị trí khác",
        when: "Khi bạn cần xem công việc của một bộ phận, ví dụ kho hoặc kế toán.",
        roles: ["DIRECTOR"],
        steps: [
          "Nhìn menu bên trái: dưới các mục chung là các nhóm mang tên từng vị trí, bắt đầu bằng nhóm **Giám đốc**.",
          "Bấm tên nhóm của vị trí đó, ví dụ **Thủ kho / Quản lý kho**, để mở danh sách mục bên trong.",
          "Bấm mục bạn cần trong nhóm đó.",
          "Bấm lại tên nhóm nếu muốn thu gọn nhóm.",
        ],
        result:
          "Màn hình của vị trí đó mở ra. Một mục mà nhiều vị trí cùng dùng sẽ lặp lại dưới mỗi nhóm; bấm ở nhóm nào cũng mở cùng một màn hình.",
      },
    ],
    terms: [
      {
        term: "**Bắt đầu làm việc**",
        meaning: "Tên phần chứa các thẻ lối tắt đến từng mục của bạn.",
      },
      {
        term: "Huy hiệu vị trí",
        meaning:
          "Nhãn tròn dưới tên của bạn, ghi vị trí: **Giám đốc**, **Thủ kho / Quản lý kho**, **Quản lý nhà máy**, **Kế toán nhà máy & mua hàng**, **Kế toán công ty** hoặc **Biên tập nội dung**. Mỗi người chỉ có một vị trí.",
      },
      {
        term: "Lời chào",
        meaning:
          "Đổi theo giờ Việt Nam: **Chào buổi sáng** từ 4 giờ đến trước 11 giờ, **Chào buổi trưa** từ 11 giờ đến trước 13 giờ, **Chào buổi chiều** từ 13 giờ đến trước 18 giờ, còn lại là **Chào buổi tối**.",
      },
      {
        term: "Tên hiển thị",
        meaning:
          "Tên lấy từ tài khoản của bạn. Nếu tài khoản chưa có tên, trang hiện phần đứng trước dấu @ trong địa chỉ Gmail.",
      },
      {
        term: "**… đang chờ duyệt**",
        meaning:
          "Nhãn trên thẻ **Danh sách nhân sự**: số tài khoản Gmail mới đăng nhập mà bạn chưa duyệt. Nhãn chỉ hiện khi số này lớn hơn 0.",
        roles: ["DIRECTOR"],
      },
      {
        term: "INV",
        meaning:
          "Viết tắt của “invoice”, nghĩa là hóa đơn bán hàng theo đơn. Chữ này có trong tên thẻ **Hóa đơn (INV)**.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        term: "USD",
        meaning: "Đô la Mỹ. Chữ này có trong tên thẻ **Tỷ giá USD**.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
    ],
    tips: [
      {
        text: "Thẻ trên trang này và menu bên trái luôn khớp nhau. Mục nào không có thẻ thì cũng không có trong menu của bạn.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Nếu huy hiệu ghi sai vị trí, đừng làm việc tiếp mà hãy báo Giám đốc ngay, vì menu và quyền xem dữ liệu đi theo vị trí.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Nếu tên hiện ra không phải tên bạn, có thể bạn đang dùng Gmail của người khác trên máy này. Hãy bấm **Đăng xuất** rồi đăng nhập lại bằng Gmail của mình.",
      },
      {
        text: "Hãy xem nhãn **… đang chờ duyệt** mỗi ngày để nhân viên mới không phải chờ lâu.",
        roles: ["DIRECTOR"],
      },
    ],
  },
  {
    path: "/assistant",
    title: "Trợ lý AI",
    summary:
      "Khung trò chuyện để hỏi nhanh bằng tiếng Việt. Trợ lý tra dữ liệu thật trên website trong phạm vi bạn được xem, rồi trả lời kèm nguồn. Trợ lý không tự thay đổi dữ liệu nào.",
    layout: [
      {
        text: "Trên cùng là tiêu đề **Trợ lý AI**.",
      },
      {
        text: "Cột trái **Hội thoại**: nút **Hội thoại mới**, danh sách hội thoại đã lưu của bạn (tên là câu hỏi đầu tiên, số lượt và thời điểm hỏi gần nhất), nút **Xóa** dưới mỗi hội thoại. Cuối cột ghi: “Hội thoại chỉ bạn đọc được và tự xóa sau 7 ngày.”",
      },
      {
        text: "Trên điện thoại, danh sách hội thoại được thu gọn. Bấm **Xem** để mở và **Ẩn** để đóng.",
      },
      {
        text: "Khung giữa là nội dung trò chuyện. Khi chưa có câu hỏi nào, khung hiện câu giới thiệu trợ lý và các nút câu hỏi mẫu dưới chữ **Gợi ý**.",
      },
      {
        text: "Dưới mỗi câu trả lời có dòng chữ nhỏ: **Đã tra cứu** (trợ lý đã tra những gì, nếu có), **Dữ liệu lúc** (thời điểm lấy dữ liệu) và **Nguồn** (tên các bản ghi, bấm vào để mở, nếu có).",
      },
      {
        text: "Dưới cùng là ô soạn câu hỏi, nút **Đính kèm tệp**, nút **Gửi** và dòng nhắc: “Excel, CSV, PDF, Word, ảnh. Tệp được đọc trên máy chủ; bản gốc không được lưu.”",
      },
      {
        text: "Khi trợ lý lập đề xuất, dưới câu trả lời có thêm thẻ vàng **Đề xuất chờ duyệt** với dòng “Chưa có việc nào được tạo. Kiểm tra rồi duyệt để tạo việc thật.”, danh sách việc, mục **Giả định**, ô **Lý do từ chối** và hai nút **Duyệt và tạo việc**, **Từ chối**.",
        roles: ["DIRECTOR"],
      },
    ],
    capabilities: [
      {
        text: "Hỏi về việc được giao cho chính bạn: hôm nay cần làm gì, việc nào quá hạn, việc nào đến hạn trong tuần, việc nào gắn với một đơn.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Hỏi về việc trong toàn công ty, cả việc của bạn lẫn việc đã giao cho nhân viên: việc nào quá hạn, việc nào đến hạn trong tuần, việc nào gắn với một đơn.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Hỏi về đơn hàng: danh sách đơn theo bước hoặc theo tên khách, đơn đang ở bước nào, vị trí nào phụ trách bước đó và các bước tiếp theo, ngày dự kiến sẵn hàng, đã được Giám đốc duyệt chưa, tình trạng kiểm tra chất lượng, tiến độ xuất khẩu và các lần chuyển bước gần nhất. Trợ lý không trả lời giá bán cho bạn.",
        roles: ["WAREHOUSE_MANAGER"],
      },
      {
        text: "Hỏi về đơn hàng: danh sách đơn theo bước hoặc theo tên khách, đơn đang ở bước nào, vị trí nào phụ trách bước đó và các bước tiếp theo, ngày dự kiến sẵn hàng, đã được Giám đốc duyệt chưa, tình trạng kiểm tra chất lượng, tiến độ xuất khẩu, các lần chuyển bước gần nhất và tổng chi phí đã ghi của đơn. Trợ lý không trả lời giá bán cho bạn.",
        roles: ["FACTORY_MANAGER", "FACTORY_ACCOUNTANT"],
      },
      {
        text: "Hỏi về đơn hàng: danh sách đơn theo bước hoặc theo tên khách, đơn đang ở bước nào, vị trí nào phụ trách bước đó và các bước tiếp theo, ngày dự kiến sẵn hàng, đã được duyệt chưa, tình trạng kiểm tra chất lượng, tiến độ xuất khẩu, các lần chuyển bước gần nhất, cùng với giá bán, hóa đơn, tiền khách đã trả và tổng chi phí của đơn.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Hỏi về đơn hàng: danh sách đơn theo bước hoặc theo tên khách, đơn đang ở bước nào, vị trí nào phụ trách bước đó và các bước tiếp theo, ngày dự kiến sẵn hàng, đã được duyệt chưa, tình trạng kiểm tra chất lượng, tiến độ xuất khẩu, các lần chuyển bước gần nhất, các việc gắn với đơn, cùng với giá bán, hóa đơn, tiền khách đã trả và tổng chi phí của đơn.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Hỏi những yêu cầu đang chờ Giám đốc phê duyệt: loại yêu cầu, nội dung tóm tắt, bản ghi liên quan và thời điểm gửi.",
        roles: [
          "DIRECTOR",
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Hỏi về các lần kiểm tra bảng biểu bạn được mở: danh sách các lần kiểm tra, kết quả một lần kiểm tra, hay vì sao một dòng bị báo lỗi.",
        roles: [
          "DIRECTOR",
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Tìm khách hàng theo tên hoặc mã, hỏi công nợ của một khách (đã lập hóa đơn, đã thu, còn nợ, tiền trả trước, từng hóa đơn còn lại và quá hạn), hỏi tổng công nợ và khách nào đang nợ quá hạn. USD và VND luôn được tách riêng.",
        roles: ["DIRECTOR", "COMPANY_ACCOUNTANT"],
      },
      {
        text: "Hỏi về nội dung website: tin tức và sản phẩm đang ở bản nháp, chờ duyệt hay đã đăng, bản dịch đã đủ chưa, mặt hàng cửa hàng nào đang ẩn và còn bao nhiêu hàng.",
        roles: ["DIRECTOR", "CONTENT_CREATOR"],
      },
      {
        text: "Nhờ trợ lý lập kế hoạch cho một đơn, soạn việc nhắc hoặc việc theo dõi sau một lần kiểm tra bảng biểu, rồi duyệt hoặc từ chối đề xuất ngay trong khung trò chuyện.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Đính kèm tối đa 3 tệp mỗi lần hỏi (Excel, CSV, PDF, Word, ảnh) để trợ lý đọc và trả lời về nội dung tệp. Bạn cũng có thể kéo tệp thả vào khung trò chuyện.",
      },
      {
        text: "Xem trước trợ lý đã đọc được gì trong tệp trước khi hỏi.",
      },
      {
        text: "Mở lại hội thoại cũ trong 7 ngày để hỏi tiếp, kể cả hỏi tiếp về bảng tính, PDF hay Word đã gửi mà không phải gửi lại.",
      },
      {
        text: "Bắt đầu hội thoại mới hoặc xóa hẳn một hội thoại.",
      },
      {
        text: "Bấm tên bản ghi ở dòng **Nguồn** để mở đúng bản ghi mà trợ lý đã dựa vào.",
      },
    ],
    limits: [
      {
        text: "Trợ lý không tự thay đổi dữ liệu: không đánh dấu xong việc, không sửa đơn, không ghi tiền và không gửi email hay Zalo. Mọi thay đổi bạn phải tự làm trên màn hình tương ứng.",
      },
      {
        text: "Trợ lý không trả lời về đơn hàng, phê duyệt, khách hàng, công nợ, giá hay tài chính. Với bạn, trợ lý chỉ tra được việc được giao cho bạn và nội dung website.",
        roles: ["CONTENT_CREATOR"],
      },
      {
        text: "Trợ lý chưa tra được **Nội dung** các trang, **Bộ sưu tập** và **Theo dõi tiến độ mẫu**. Hãy mở thẳng các mục đó.",
        roles: ["CONTENT_CREATOR"],
      },
      {
        text: "Trợ lý không tra được khách hàng, công nợ khách hàng theo hóa đơn, hóa đơn (INV), tiền khách trả hay giá bán của đơn.",
        roles: ["WAREHOUSE_MANAGER", "FACTORY_MANAGER", "FACTORY_ACCOUNTANT"],
      },
      {
        text: "Trợ lý chưa tra được **Bảng xuất kho sơn**, **Nguyên vật liệu**, **Hóa đơn bán hàng** và **Công nợ bán sơn**. Hãy mở thẳng các mục đó.",
        roles: ["WAREHOUSE_MANAGER"],
      },
      {
        text: "Trợ lý chưa tra được từng khoản trong **Chi phí đơn hàng**; trợ lý chỉ cho biết tổng chi phí của một đơn.",
        roles: ["FACTORY_MANAGER"],
      },
      {
        text: "Trợ lý chưa tra được **Nhà cung cấp** và từng khoản trong **Chi phí đơn hàng**; trợ lý chỉ cho biết tổng chi phí của một đơn.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Trợ lý chưa tra được **Hóa đơn bán hàng**, **Công nợ bán sơn**, **Đơn cửa hàng**, **Thu – Chi** và **Tỷ giá USD**. Hãy mở thẳng các mục đó.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Trợ lý chưa tra được **Danh sách nhân sự**, **Cơ cấu tổ chức** và **Yêu cầu báo giá**. Hãy mở thẳng các mục đó.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Trợ lý không tra được nội dung website (tin tức, sản phẩm, cửa hàng).",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Bạn không nhờ trợ lý lập kế hoạch hay tạo việc được. Chỉ Giám đốc giao việc và duyệt đề xuất của trợ lý.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Hội thoại chỉ người tạo đọc được. Không ai xem được hội thoại của người khác, kể cả Giám đốc.",
      },
      {
        text: "Hội thoại và tệp đã đọc tự xóa sau 7 ngày kể từ lần hỏi cuối trong hội thoại đó. Xóa rồi thì không lấy lại được. Cột trái hiện tối đa 20 hội thoại gần nhất.",
      },
      {
        text: "Ảnh chỉ được trợ lý xem trong đúng lượt bạn gửi kèm. Muốn hỏi tiếp về ảnh ở lượt sau, hãy đính kèm lại ảnh.",
      },
      {
        text: "Mỗi lần hỏi đính kèm tối đa 3 tệp. Mỗi lần tải lên, tổng dung lượng các tệp không quá 4 MB; mỗi ảnh không quá 2 MB. Mỗi câu hỏi dài tối đa 4.000 ký tự.",
      },
      {
        text: "Chỉ nhận Excel (.xlsx, .xls), CSV (.csv, hoặc .txt đọc như CSV), PDF, Word (.docx) và ảnh (.png, .jpg, .jpeg, .webp, .gif). Tệp đổi đuôi, tệp đặt mật khẩu, tệp có macro và tệp rỗng bị từ chối.",
      },
      {
        text: "Trợ lý đọc tối đa 200 dòng và 20 cột của bảng tính, 40 trang đầu của PDF. Phần dài hơn bị cắt và chip tệp ghi **đã cắt bớt**. PDF chỉ có ảnh quét, không có chữ, thì chưa đọc được.",
      },
      {
        text: "Bảng tính đính kèm chỉ được đọc như văn bản, không được đối chiếu với dữ liệu trên website. Muốn đối chiếu, hãy dùng mục **Kiểm tra bảng biểu**.",
        roles: [
          "DIRECTOR",
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Trợ lý được dặn nói rõ số tiền trong tệp đính kèm là “theo tệp đính kèm”, không coi đó là số liệu của hệ thống. Tệp cũng không giúp xem được số liệu mà bạn không có quyền xem.",
      },
      {
        text: "Mỗi người gửi tối đa 20 câu hỏi trong 5 phút và tải tệp tối đa 20 lần trong 10 phút.",
      },
    ],
    flows: [
      {
        title: "Hỏi trợ lý một câu",
        when: "Khi bạn cần tra nhanh thay vì mở từng màn hình.",
        steps: [
          "Bấm **Trợ lý AI** trong menu.",
          "Nhập câu hỏi vào ô dưới cùng, ghi rõ mã đơn, tên khách hoặc tên việc nếu có.",
          "Bấm **Gửi** hoặc nhấn phím Enter. Muốn xuống dòng thì nhấn Shift + Enter.",
          "Chờ trong khi màn hình báo **Đang tra cứu…** hoặc **Đã tra cứu**; câu trả lời hiện dần từng đoạn.",
          "Đọc câu trả lời và dòng **Nguồn** bên dưới.",
          "Bấm tên bản ghi ở **Nguồn** để mở và kiểm tra lại trước khi làm theo.",
          "Nhập câu hỏi tiếp nếu cần; trợ lý hiểu câu mới tiếp nối câu trước.",
        ],
        result:
          "Hội thoại được lưu vào cột **Hội thoại**, lấy câu hỏi đầu tiên làm tên. Dữ liệu trên website không thay đổi.",
      },
      {
        title: "Hỏi bằng câu gợi ý",
        when: "Khi bạn mới mở trợ lý và chưa biết hỏi gì.",
        steps: [
          "Bấm **Hội thoại mới** nếu khung trò chuyện đang có nội dung.",
          "Xem các nút dưới chữ **Gợi ý**.",
          "Bấm một câu gợi ý; câu đó được gửi ngay.",
          "Đọc câu trả lời và hỏi tiếp nếu cần.",
        ],
        result:
          "Bạn nhận câu trả lời như khi tự gõ câu hỏi. Mọi người đều có gợi ý “Hôm nay tôi cần làm gì?” và “Việc nào đã quá hạn?”.",
      },
      {
        title: "Hỏi về một tệp Excel, PDF, Word hoặc ảnh",
        when: "Khi bạn có tệp và muốn trợ lý tóm tắt hoặc tìm thông tin trong đó.",
        steps: [
          "Bấm **Đính kèm tệp**, hoặc kéo tệp thả vào khung trò chuyện khi thấy chữ **Thả tệp vào đây**.",
          "Chọn tối đa 3 tệp.",
          "Chờ nút đổi thành **Đang đọc tệp…** rồi trở lại bình thường.",
          "Kiểm tra chip của từng tệp: định dạng, tên, dung lượng và chữ **đã cắt bớt** nếu có.",
          "Bấm **Đã đọc được gì** để xem đoạn đầu mà trợ lý đọc được và **Ghi chú khi đọc** nếu có.",
          "Bấm dấu × trên chip để bỏ tệp chọn nhầm.",
          "Nhập câu hỏi về tệp. Bạn cũng có thể để trống ô câu hỏi.",
          "Bấm **Gửi**.",
        ],
        result:
          "Trợ lý trả lời dựa trên phần đã đọc được. Trong 7 ngày, bạn hỏi tiếp về bảng tính, PDF hay Word trong cùng hội thoại mà không cần gửi lại; riêng ảnh thì phải gửi lại. Website không giữ bản gốc của tệp.",
      },
      {
        title: "Mở lại một hội thoại cũ",
        when: "Khi bạn muốn hỏi tiếp một chuyện đã hỏi mấy hôm trước.",
        steps: [
          "Bấm **Xem** cạnh chữ **Hội thoại** để mở danh sách, nếu bạn đang dùng điện thoại.",
          "Bấm tên hội thoại cần mở; dòng dưới tên đổi thành **Đang mở…**.",
          "Đọc lại các câu hỏi và câu trả lời cũ; dưới mỗi câu trả lời cũ ghi **Đã trả lời lúc**.",
          "Nhập câu hỏi tiếp rồi bấm **Gửi**.",
        ],
        result:
          "Câu hỏi mới được thêm vào hội thoại đó, và hạn tự xóa của hội thoại được tính lại 7 ngày từ lúc này.",
      },
      {
        title: "Bắt đầu hội thoại mới",
        when: "Khi bạn chuyển sang hỏi một chuyện khác hẳn, để trợ lý không lẫn với câu hỏi cũ.",
        steps: [
          "Bấm **Hội thoại mới** ở cột trái.",
          "Nhập câu hỏi mới.",
          "Bấm **Gửi**.",
        ],
        result:
          "Sau khi trợ lý trả lời câu đầu tiên, hội thoại mới xuất hiện trên đầu danh sách. Hội thoại cũ vẫn còn trong danh sách cho tới khi hết 7 ngày.",
      },
      {
        title: "Xóa một hội thoại",
        when: "Khi hội thoại không còn cần hoặc bạn đã gửi nhầm tệp.",
        steps: [
          "Tìm hội thoại trong cột **Hội thoại**.",
          "Bấm **Xóa** dưới tên hội thoại; chữ đổi thành **Xóa hẳn?**.",
          "Bấm **Xóa hẳn?** một lần nữa để xác nhận. Nếu bấm ra chỗ khác, nút trở lại **Xóa** và không có gì bị xóa.",
        ],
        result:
          "Hội thoại và các tệp đã đọc trong đó bị xóa vĩnh viễn. Nếu đó là hội thoại đang mở, khung trò chuyện trở về trống.",
      },
      {
        title: "Nhờ trợ lý lập kế hoạch cho một đơn",
        when: "Khi một đơn hàng cần chia thành các việc cho những bước còn lại.",
        roles: ["DIRECTOR"],
        steps: [
          "Mở trang chi tiết đơn hàng và bấm **Lập kế hoạch với trợ lý →**, hoặc tự gõ vào trợ lý “Lập kế hoạch cho đơn” kèm mã đơn.",
          "Kiểm tra câu hỏi trong ô soạn (khi đi từ trang đơn, câu hỏi đã có sẵn) rồi bấm **Gửi**.",
          "Đọc thẻ **Đề xuất chờ duyệt**: mỗi dòng là một bước còn lại của đơn, kèm hạn và vị trí phụ trách.",
          "Bấm **Giả định** để đọc những điều trợ lý đã tự giả định, ví dụ đơn chưa có ngày sẵn hàng, số ngày mặc định của một bước, hoặc vị trí chưa có người.",
          "Bấm **Duyệt và tạo việc** nếu đồng ý.",
          "Nhập **Lý do từ chối** rồi bấm **Từ chối** nếu không đồng ý.",
          "Bấm **Xem việc cần làm** để mở màn hình **Giao việc** và kiểm tra các việc vừa tạo.",
        ],
        result:
          "Khi duyệt, thẻ báo “Đã duyệt và tạo việc.” và các việc thật được tạo. Việc của vị trí có đúng một người được giao cho người đó. Việc của vị trí chưa có người hoặc có nhiều người thì chưa có người nhận, và bạn giao lại ở **Giao việc**. Khi từ chối, thẻ báo “Đã từ chối đề xuất.” và không có việc nào được tạo.",
      },
      {
        title: "Tạo việc theo dõi từ một lần kiểm tra bảng biểu",
        when: "Khi một bảng tính đã kiểm tra còn nhiều dòng lỗi cần người xử lý.",
        roles: ["DIRECTOR"],
        steps: [
          "Mở kết quả của lần kiểm tra trong **Kiểm tra bảng biểu**.",
          "Bấm **Tạo việc theo dõi với trợ lý →**.",
          "Bấm **Gửi** với câu hỏi đã có sẵn trong ô soạn.",
          "Đọc các thẻ **Đề xuất chờ duyệt**: mỗi dòng lỗi thành một việc, hạn sau 3 ngày; dòng thuộc cùng một đơn nằm chung một thẻ, các dòng còn lại nằm ở thẻ cuối.",
          "Bấm **Duyệt và tạo việc** trên từng thẻ, hoặc nhập **Lý do từ chối** rồi bấm **Từ chối**.",
        ],
        result:
          "Khi duyệt, các việc theo dõi được tạo, mặc định giao cho bạn, và hiện trên **Giao việc**; muốn chuyển cho nhân viên thì đổi người nhận ở đó. Tên việc chỉ ghi số dòng, tên tệp và loại lỗi, không ghi số tiền.",
      },
      {
        title: "Nhờ trợ lý soạn việc nhắc",
        when: "Khi bạn muốn ghi nhanh một việc cần nhớ.",
        roles: ["DIRECTOR"],
        steps: [
          "Gõ yêu cầu, ví dụ “Nhắc tôi gọi nhà cung cấp sơn vào ngày 20”.",
          "Bấm **Gửi**.",
          "Đọc thẻ **Đề xuất chờ duyệt**: tên việc và hạn.",
          "Bấm **Duyệt và tạo việc** nếu đúng, hoặc nhập **Lý do từ chối** rồi bấm **Từ chối**.",
        ],
        result:
          "Việc chỉ được tạo sau khi bạn bấm duyệt, và mặc định giao cho chính bạn nên hiện trong **Công việc được giao** của bạn. Muốn giao cho nhân viên, hãy đổi người nhận ở **Giao việc**.",
      },
      {
        title: "Gửi lại khi gặp lỗi",
        when: "Khi thay cho câu trả lời là một dòng chữ đỏ.",
        steps: [
          "Đọc dòng chữ đỏ để biết lý do (xem phần Mẹo).",
          "Kiểm tra ô câu hỏi: câu hỏi và tệp đính kèm đã được trả lại vào ô soạn.",
          "Sửa theo lý do nếu cần, ví dụ chờ một lát hoặc bỏ tệp quá lớn.",
          "Bấm **Gửi** lại.",
        ],
        result:
          "Lượt bị lỗi không được lưu và không có thao tác nào xảy ra, nên gửi lại là an toàn.",
      },
    ],
    terms: [
      {
        term: "AI",
        meaning:
          "Viết tắt tiếng Anh của “trí tuệ nhân tạo”: chương trình máy tính hiểu câu hỏi bằng lời và soạn câu trả lời.",
      },
      {
        term: "**Hội thoại**",
        meaning:
          "Một chuỗi câu hỏi và câu trả lời liên tiếp. Tên hội thoại là câu hỏi đầu tiên; nếu lượt đầu chỉ gửi tệp thì tên là tên tệp đầu tiên.",
      },
      {
        term: "**… lượt**",
        meaning:
          "Số tin trong hội thoại, tính cả câu hỏi và câu trả lời. Ví dụ **4 lượt** là 2 câu hỏi và 2 câu trả lời.",
      },
      {
        term: "**Gợi ý**",
        meaning:
          "Các câu hỏi mẫu, chỉ gồm những câu hợp với phạm vi bạn được xem.",
      },
      {
        term: "Các câu gợi ý của bạn",
        meaning:
          "“Hôm nay tôi cần làm gì?”, “Việc nào đã quá hạn?”, “Tóm tắt tiến độ các đơn hàng đang mở.”, “Có gì đang chờ Giám đốc phê duyệt?”.",
        roles: ["WAREHOUSE_MANAGER", "FACTORY_MANAGER", "FACTORY_ACCOUNTANT"],
      },
      {
        term: "Các câu gợi ý của bạn",
        meaning:
          "“Hôm nay tôi cần làm gì?”, “Việc nào đã quá hạn?”, “Tóm tắt tiến độ các đơn hàng đang mở.”, “Có gì đang chờ Giám đốc phê duyệt?”, “Khách nào còn công nợ quá hạn?”.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        term: "Các câu gợi ý của bạn",
        meaning:
          "“Hôm nay tôi cần làm gì?”, “Việc nào đã quá hạn?”, “Bài viết nào còn ở bản nháp?”.",
        roles: ["CONTENT_CREATOR"],
      },
      {
        term: "Các câu gợi ý của bạn",
        meaning:
          "“Hôm nay tôi cần làm gì?”, “Việc nào đã quá hạn?”, “Tóm tắt tiến độ các đơn hàng đang mở.”, “Có gì đang chờ Giám đốc phê duyệt?”, “Khách nào còn công nợ quá hạn?”, “Lập kế hoạch cho đơn RD-…”, “Bài viết nào còn ở bản nháp?”.",
        roles: ["DIRECTOR"],
      },
      {
        term: "**Đã tra cứu**",
        meaning:
          "Danh sách các lần trợ lý tra dữ liệu để trả lời, ghi bằng tên tiếng Anh viết liền (ví dụ list_my_tasks là tra danh sách việc). Nếu sau tên có chữ trong ngoặc thì lần tra đó không thành công, ví dụ (PERMISSION_DENIED) là bạn không có quyền xem, (NOT_FOUND) là không tìm thấy, (UNAVAILABLE) là hệ thống tạm thời không phản hồi.",
      },
      {
        term: "**Dữ liệu lúc**",
        meaning:
          "Thời điểm trợ lý lấy dữ liệu cho câu trả lời. Dữ liệu có thể đã thay đổi sau thời điểm này.",
      },
      {
        term: "**Đã trả lời lúc**",
        meaning:
          "Hiện thay cho **Dữ liệu lúc** khi bạn mở lại một hội thoại cũ: thời điểm câu trả lời được viết.",
      },
      {
        term: "**Nguồn**",
        meaning:
          "Các bản ghi trên website mà câu trả lời dựa vào, ví dụ một đơn hàng hay một hóa đơn. Bấm vào để mở.",
      },
      {
        term: "Excel, CSV, PDF, Word",
        meaning:
          "Các loại tệp được nhận. Excel là bảng tính (.xlsx, .xls); CSV là bảng tính dạng chữ thuần (.csv); PDF là tài liệu dạng trang in (.pdf); Word là văn bản (.docx).",
      },
      {
        term: "MB",
        meaning:
          "Đơn vị dung lượng tệp. Dung lượng mỗi tệp hiện ngay trên chip tệp sau khi tải lên.",
      },
      {
        term: "**Đã đọc được gì**",
        meaning:
          "Mục mở ra dưới chip tệp, cho xem đoạn đầu mà website đọc được từ tệp. Với ảnh, mục này ghi “Ảnh được gửi thẳng cho mô hình.”",
      },
      {
        term: "**Ghi chú khi đọc**",
        meaning:
          "Lưu ý của website khi đọc tệp, ví dụ trang bị bỏ, trang tính bị ẩn hoặc phần bị cắt.",
      },
      {
        term: "**đã cắt bớt**",
        meaning:
          "Tệp dài hơn mức trợ lý đọc được. Trợ lý chỉ thấy phần đầu, nên đừng coi câu trả lời là đã xét toàn bộ tệp.",
      },
      {
        term: "**Câu trả lời bị cắt ngắn.**",
        meaning:
          "Câu trả lời quá dài nên bị dừng giữa chừng. Hãy hỏi hẹp lại, ví dụ theo một đơn hoặc một khách.",
      },
      {
        term: "USD, VND",
        meaning:
          "Đô la Mỹ và Việt Nam đồng. Trợ lý không cộng hay quy đổi hai loại tiền này với nhau.",
        roles: ["DIRECTOR", "COMPANY_ACCOUNTANT"],
      },
      {
        term: "**Đề xuất chờ duyệt**",
        meaning:
          "Bản nháp danh sách việc do trợ lý soạn. Khi chưa bấm **Duyệt và tạo việc** thì chưa có việc nào được tạo.",
        roles: ["DIRECTOR"],
      },
      {
        term: "**Giả định**",
        meaning:
          "Những điều trợ lý phải tự giả định khi soạn đề xuất, ví dụ số ngày mặc định của một bước. Con số trong ngoặc là số giả định.",
        roles: ["DIRECTOR"],
      },
      {
        term: "Vị trí phụ trách trong đề xuất",
        meaning:
          "Hiện bằng chữ tiếng Anh: DIRECTOR là Giám đốc, WAREHOUSE_MANAGER là Thủ kho, FACTORY_MANAGER là Quản lý nhà máy, FACTORY_ACCOUNTANT là Kế toán nhà máy, COMPANY_ACCOUNTANT là Kế toán công ty, CONTENT_CREATOR là Biên tập nội dung. Các chữ này cũng có thể xuất hiện trong mục **Giả định**.",
        roles: ["DIRECTOR"],
      },
      {
        term: "RD-…",
        meaning: "Mã đơn hàng, ví dụ RD-20260905-K7QM.",
        roles: [
          "DIRECTOR",
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
    ],
    tips: [
      {
        text: "Luôn bấm **Nguồn** để kiểm tra lại trước khi làm theo câu trả lời, nhất là với số tiền và ngày tháng.",
      },
      {
        text: "Hỏi càng cụ thể càng tốt: ghi mã đơn, tên khách, tên việc. Khi có nhiều bản ghi giống nhau, trợ lý được dặn liệt kê ra và hỏi lại bạn chọn cái nào.",
      },
      {
        text: "Nếu trợ lý nói bạn không có quyền xem một dữ liệu, đừng hỏi vòng bằng cách khác: trợ lý được dặn không tìm đường khác để lấy dữ liệu đó. Hãy hỏi người phụ trách dữ liệu đó.",
      },
      {
        text: "Ô soạn và dòng mô tả trên thẻ **Trợ lý AI** ở trang **Tổng quan** có nhắc đến đơn hàng và công nợ, nhưng với bạn trợ lý không có dữ liệu đó. Đó không phải lỗi mà là giới hạn của vị trí bạn.",
        roles: ["CONTENT_CREATOR"],
      },
      {
        text: "Câu giới thiệu trong khung trống và ô soạn có nhắc đến đề xuất kế hoạch và việc cần làm, nhưng phần đó chỉ Giám đốc dùng được.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Câu gợi ý “Lập kế hoạch cho đơn RD-…” được gửi nguyên văn, chưa có mã đơn thật. Tốt hơn là tự gõ câu này kèm mã đơn, hoặc bấm **Lập kế hoạch với trợ lý →** trên trang chi tiết đơn.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Trợ lý không đánh dấu việc đã xong. Làm xong việc thì bấm **Xong** ở **Công việc được giao**.",
      },
      {
        text: "Tải lại trang không làm mất hội thoại đang mở. Nút quay lại của trình duyệt đưa bạn về hội thoại trước đó.",
      },
      {
        text: "Dòng đỏ “Phiên đăng nhập đã hết. Đăng nhập lại.”: hãy đăng nhập lại bằng Gmail rồi hỏi lại.",
      },
      {
        text: "Dòng đỏ “Bạn gửi quá nhanh. Đợi một lát rồi thử lại.”: bạn đã gửi quá 20 câu trong 5 phút, hoặc tải tệp quá 20 lần trong 10 phút.",
      },
      {
        text: "Dòng đỏ “Mô hình không phản hồi kịp. Không có thao tác nào được thực hiện. Thử lại.”, “Nhà cung cấp mô hình báo lỗi. Không có thao tác nào được thực hiện.” hoặc “Hệ thống tạm thời không phản hồi.”: chờ một chút rồi bấm **Gửi** lại.",
      },
      {
        text: "Dòng đỏ “Không kết nối được máy chủ.”: kiểm tra mạng internet rồi gửi lại.",
      },
      {
        text: "Nếu cả khung chỉ hiện “Trợ lý chưa được cấu hình trên máy chủ (thiếu khóa AI).”, trợ lý đang tắt trên toàn website. Hãy báo Giám đốc; các màn hình khác vẫn dùng bình thường.",
      },
      {
        text: "Dòng đỏ “Tài khoản của bạn không có quyền dùng trợ lý.”: hãy báo Giám đốc kiểm tra vị trí của tài khoản.",
      },
      {
        text: "Dòng đỏ “Hội thoại này không còn nữa (đã hết hạn hoặc bị xóa). Câu hỏi tiếp theo sẽ mở hội thoại mới.”: hội thoại đã quá 7 ngày hoặc đã bị xóa. Bấm **Gửi** lại để hỏi trong hội thoại mới. Tệp đã gửi ở các lượt trước của hội thoại đó cũng không còn, nên phải đính kèm lại.",
      },
      {
        text: "Dòng đỏ “Hội thoại hoặc tệp không còn nữa (đã hết hạn hoặc bị xóa).”: bấm dấu × để bỏ tệp đó, đính kèm lại tệp rồi gửi lại; nếu lỗi hiện khi mở hội thoại cũ thì hội thoại đó đã bị xóa.",
      },
      {
        text: "Lỗi tệp: “Mỗi lượt chỉ đính kèm được tối đa 3 tệp.”, “Tệp vượt quá dung lượng cho phép.”, “Định dạng không được nhận. Chỉ Excel, CSV, PDF, Word và ảnh.”, “Định dạng ảnh này không được nhận.”, “Tệp rỗng.”, “Bảng có quá nhiều dòng để đọc trong chat.”. Hãy bỏ bớt tệp, chia nhỏ tệp, tải từng tệp một hoặc lưu lại đúng định dạng.",
      },
      {
        text: "Lỗi tệp: “Tệp đặt mật khẩu nên không đọc được.”, “Tệp có macro nên bị từ chối.”, “Cấu trúc tệp bất thường nên bị từ chối.”, “Không đọc được tệp này.”. Hãy mở tệp, bỏ mật khẩu hoặc lưu thành bản Excel thường (.xlsx) rồi gửi lại.",
      },
      {
        text: "Lỗi “Không tìm thấy chữ trong tệp (PDF chỉ có ảnh quét chưa đọc được).”: gửi bản PDF có chữ, bản Excel, hoặc chụp ảnh trang cần hỏi. Nếu gặp “Mô hình đang cấu hình không xem được ảnh. Gửi bản PDF hoặc Excel.” thì gửi PDF hoặc Excel thay cho ảnh.",
      },
      {
        text: "Nhớ rằng tệp chỉ là giấy tờ ai đó đã viết. Một phiếu thu trong PDF không có nghĩa là khoản tiền đã được ghi trên website.",
      },
      {
        text: "Mở lại hội thoại cũ có đề xuất thì thẻ duyệt không còn; thay vào đó là dòng “Lượt này có đề xuất. Duyệt hoặc từ chối ở trang Việc cần làm.” Bấm **Xem việc cần làm** để mở **Giao việc** và duyệt ở đó.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Lỗi khi duyệt: “Đề xuất đã được quyết định trước đó.” (đã có người duyệt hoặc từ chối), “Đơn hàng đã thay đổi sau khi đề xuất; hãy yêu cầu kế hoạch mới.”, “Kế hoạch không còn hợp lệ; hãy yêu cầu kế hoạch mới.”, “Dữ liệu chưa hợp lệ (từ chối cần lý do).” (hãy nhập **Lý do từ chối**), “Đề xuất đã thay đổi; tải lại trang.”",
        roles: ["DIRECTOR"],
      },
      {
        text: "Nút **Lập kế hoạch với trợ lý →** chỉ có trên đơn chưa đóng và chưa hủy. Việc tạo từ đề xuất không tự gửi tin báo việc mới cho người nhận; hãy kiểm tra ở **Giao việc** và báo cho họ nếu cần.",
        roles: ["DIRECTOR"],
      },
    ],
  },
  {
    path: "/my-tasks",
    title: "Công việc được giao",
    summary:
      "Hộp việc của riêng bạn: những việc được giao cho bạn và hạn của từng việc. Làm xong thì bấm **Xong**; không kịp hạn thì bấm **Xin gia hạn** và ghi lý do. Ở đây bạn cũng liên kết Zalo để nhận tin báo việc.",
    layout: [
      {
        text: "Đầu trang là tiêu đề **Công việc được giao** và câu nhắc: hạn là cuối ngày làm việc theo giờ Việt Nam, hạn chỉ đổi khi Giám đốc duyệt.",
      },
      {
        text: "Ngay dưới tiêu đề có thể hiện một dòng thông báo: màu vàng khi thao tác thành công, màu đỏ khi thao tác không thành công.",
      },
      {
        text: "Ba nút lọc: **Đang làm** (chọn sẵn khi mở trang), **Đã xong** và **Tất cả**.",
      },
      {
        text: "Danh sách thẻ việc. Mỗi thẻ có tên việc, dòng hạn, **Người giao**, mã đơn (nếu có), ghi chú của người giao và tình trạng xin gia hạn (nếu có). Việc đang làm có nút **Xong** bên phải và mục **Xin gia hạn** ở cuối thẻ.",
      },
      {
        text: "Việc đã xong hoặc đã bị hủy hiện mờ và không có nút nào.",
      },
      {
        text: "Nếu mục đang chọn không có việc, trang ghi “Không có việc nào trong mục này.”",
      },
      {
        text: "Cuối trang là khung **Zalo của tôi**: hướng dẫn liên kết, trạng thái **Đã liên kết Zalo** hoặc **Chưa liên kết**, mã liên kết khi mã còn hạn, nút **Lấy mã liên kết**, và nút **Gỡ liên kết** khi đã liên kết.",
      },
      {
        text: "Khi bạn mở trang từ đường link trong email hoặc Zalo báo việc mới hay kết quả xin gia hạn, bộ lọc chuyển sang **Tất cả** và thẻ của việc đó có viền vàng.",
      },
    ],
    capabilities: [
      {
        text: "Xem mọi việc được giao cho bạn, lọc theo **Đang làm**, **Đã xong** hoặc **Tất cả**.",
      },
      {
        text: "Nhận biết ngay việc **Quá hạn** (chữ đỏ), việc **Hạn hôm nay** (chữ vàng) và việc ưu tiên cao (dấu ! màu đỏ trước tên).",
      },
      {
        text: "Bấm **Xong** để báo đã làm xong một việc.",
      },
      {
        text: "Xin dời hạn một việc: chọn ngày mới, ghi lý do và gửi cho Giám đốc duyệt.",
      },
      {
        text: "Theo dõi yêu cầu gia hạn: đang chờ, đã được duyệt hay không được duyệt, kèm ghi chú của Giám đốc.",
      },
      {
        text: "Bấm mã đơn trên thẻ để mở trang chi tiết của đơn hàng liên quan.",
        roles: [
          "DIRECTOR",
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Liên kết Zalo của bạn để nhận tin qua Zalo, hoặc gỡ liên kết khi đổi tài khoản Zalo.",
      },
      {
        text: "Nhận tin qua email Gmail của bạn, và qua Zalo nếu đã liên kết, khi: có việc mới giao cho bạn, việc được chuyển sang bạn hoặc việc bị đổi hạn; Giám đốc trả lời yêu cầu gia hạn; việc sắp đến hạn, đến hạn hoặc đã quá hạn. Tin chỉ gửi đi khi công ty đang bật chức năng gửi thông báo.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Nhận tin nhắc hạn qua email Gmail của bạn, và qua Zalo nếu đã liên kết, khi việc của bạn sắp đến hạn, đến hạn hoặc đã quá hạn. Tin chỉ gửi đi khi công ty đang bật chức năng gửi thông báo.",
        roles: ["DIRECTOR"],
      },
    ],
    limits: [
      {
        text: "Bạn không tạo việc, không giao việc cho người khác, không sửa tên, hạn hay mức ưu tiên của việc. Giám đốc làm những việc này ở màn hình **Giao việc**.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Màn hình này chỉ có việc giao cho chính bạn. Tạo việc, sửa việc và xem việc của nhân viên thì dùng màn hình **Giao việc**.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Bạn chỉ thấy việc của mình, không thấy việc của đồng nghiệp.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Bạn không tự đổi hạn được. Hạn chỉ đổi khi Giám đốc bấm duyệt yêu cầu gia hạn.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Mỗi việc chỉ có một yêu cầu gia hạn chờ duyệt tại một thời điểm; trong lúc chờ, mục **Xin gia hạn** không hiện trên thẻ. Ngày xin dời phải từ ngày mai trở đi và khác hạn hiện tại.",
      },
      {
        text: "Màn hình không có nút mở lại việc đã bấm **Xong** và không có nút hủy việc. Nếu bấm **Xong** nhầm, hãy báo Giám đốc.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Tin nhắn email và Zalo chỉ để báo. Trả lời tin nhắn không đánh dấu xong và không xin gia hạn được; mọi thao tác phải làm trên website.",
      },
      {
        text: "Zalo chỉ liên kết bằng mã, không theo tên hay số điện thoại. Mỗi tài khoản Zalo chỉ gắn với một tài khoản website. Website chưa gửi tin vào nhóm Zalo.",
      },
    ],
    flows: [
      {
        title: "Xem việc cần làm hôm nay",
        when: "Đầu mỗi ngày làm việc.",
        steps: [
          "Bấm **Công việc được giao** trong menu.",
          "Kiểm tra bộ lọc **Đang làm** đang được chọn.",
          "Xem trước các thẻ có chữ đỏ **Quá hạn**, rồi đến các thẻ có chữ vàng **Hạn hôm nay**.",
          "Đọc tên việc, ghi chú và **Người giao** trên từng thẻ.",
          "Bấm mã đơn trên thẻ, nếu có, để mở đơn hàng liên quan.",
        ],
        result: "Bạn biết việc nào cần làm trước và hạn của từng việc.",
      },
      {
        title: "Báo đã làm xong một việc",
        when: "Ngay khi bạn hoàn thành việc.",
        steps: [
          "Mở **Công việc được giao**.",
          "Tìm thẻ của việc vừa làm xong trong mục **Đang làm**.",
          "Bấm **Xong** bên phải thẻ.",
          "Kiểm tra dòng vàng “Đã đánh dấu xong.”",
          "Bấm **Đã xong** để thấy thẻ với dòng **Xong lúc** và thời điểm bạn bấm.",
        ],
        result:
          "Việc chuyển sang **Đã xong** và không còn tin nhắc hạn nữa. Nếu việc đang có yêu cầu gia hạn chờ duyệt, yêu cầu đó tự bỏ. Không có tin nhắn nào gửi đi; người giao việc thấy việc đã xong trên màn hình **Giao việc**.",
      },
      {
        title: "Xin gia hạn một việc",
        when: "Khi bạn thấy không kịp hạn. Nên xin trước khi hạn qua.",
        steps: [
          "Mở **Công việc được giao** và tìm thẻ của việc.",
          "Bấm **Xin gia hạn** ở cuối thẻ để mở ô nhập.",
          "Chọn ngày ở ô **Hạn mới**, từ ngày mai trở đi.",
          "Nhập lý do cụ thể vào ô **Lý do**.",
          "Bấm **Gửi yêu cầu**.",
          "Kiểm tra dòng vàng “Đã gửi yêu cầu gia hạn cho Giám đốc.”",
          "Kiểm tra thẻ hiện dòng “Đang chờ Giám đốc duyệt: xin dời sang” kèm ngày bạn xin và **Lý do đã gửi**.",
        ],
        result:
          "Giám đốc nhận tin “Có người xin gia hạn” qua email, và qua Zalo nếu đã liên kết (khi công ty đang bật gửi thông báo), rồi duyệt hoặc từ chối ở **Giao việc**. Trong lúc chờ, hạn cũ vẫn giữ nguyên và bạn vẫn làm việc bình thường.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        title: "Xem kết quả xin gia hạn",
        when: "Khi nhận tin “Đã duyệt xin gia hạn” hoặc “Không duyệt xin gia hạn”, hoặc khi muốn tự kiểm tra.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
        steps: [
          "Bấm đường link “Mở việc trong cổng quản trị” trong email hoặc Zalo, hoặc mở **Công việc được giao** và bấm **Tất cả**.",
          "Đăng nhập bằng Gmail nếu website yêu cầu.",
          "Tìm thẻ của việc (khi mở từ đường link, thẻ có viền vàng).",
          "Đọc dòng “Giám đốc đã duyệt gia hạn tới” hoặc “Giám đốc không duyệt gia hạn tới” cùng ngày và **Ghi chú** của Giám đốc nếu có.",
          "Kiểm tra dòng hạn trên thẻ đã đổi sang ngày mới, nếu được duyệt.",
          "Sắp xếp làm xong theo hạn cũ, hoặc gửi yêu cầu mới với lý do rõ hơn, nếu không được duyệt.",
        ],
        result:
          "Khi được duyệt, hạn mới có hiệu lực ngay và tin nhắc hạn tính theo hạn mới. Khi không được duyệt, hạn và tin nhắc giữ nguyên.",
      },
      {
        title: "Nhận một việc mới",
        when: "Khi có email hoặc Zalo “Bạn được giao một việc mới”.",
        steps: [
          "Đọc tin nhắn: tên việc, **Hạn** và **Người giao**.",
          "Bấm đường link “Mở việc trong cổng quản trị”.",
          "Đăng nhập bằng Gmail nếu website yêu cầu.",
          "Đọc thẻ có viền vàng và ghi chú của người giao.",
          "Bấm **Xin gia hạn** ngay nếu thấy hạn không thực tế.",
        ],
        result:
          "Việc nằm trong mục **Đang làm** cho tới khi bạn bấm **Xong**. Không cần bấm xác nhận đã nhận việc.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        title: "Liên kết Zalo để nhận tin",
        when: "Một lần, khi bạn muốn nhận việc mới và nhắc hạn trên Zalo.",
        steps: [
          "Kéo xuống khung **Zalo của tôi** ở cuối trang.",
          "Bấm **Lấy mã liên kết**.",
          "Kiểm tra dòng vàng “Đã tạo mã liên kết Zalo.” và dòng “Mã của bạn (hết hạn sau 15 phút):” kèm mã dạng RD- và 6 ký tự.",
          "Mở Zalo trên điện thoại bằng chính tài khoản Zalo của bạn.",
          "Tìm Zalo OA của công ty.",
          "Gửi cho Zalo OA một tin nhắn chứa đúng mã đó, trong vòng 15 phút.",
          "Đọc tin trả lời của Zalo OA: “Red Door: đã liên kết Zalo này với tài khoản cổng quản trị của bạn. Nhắc việc sẽ được gửi tại đây.”",
          "Tải lại trang và kiểm tra khung ghi **Đã liên kết Zalo**.",
        ],
        result:
          "Từ đây bạn nhận tin qua cả email và Zalo. Tin trả lời của Zalo OA chỉ có khi công ty đang bật gửi tin; nếu không có tin trả lời, hãy dựa vào trạng thái trong khung **Zalo của tôi**.",
      },
      {
        title: "Gỡ liên kết Zalo",
        when: "Khi bạn đổi tài khoản Zalo hoặc không muốn nhận tin qua Zalo nữa.",
        steps: [
          "Kéo xuống khung **Zalo của tôi**.",
          "Bấm **Gỡ liên kết**.",
          "Kiểm tra dòng vàng “Đã gỡ liên kết Zalo.” và trạng thái **Chưa liên kết**.",
          "Làm lại các bước liên kết Zalo từ đầu nếu bạn dùng Zalo mới.",
        ],
        result:
          "Bạn không còn nhận tin qua Zalo, nhưng vẫn nhận tin qua email.",
      },
    ],
    terms: [
      {
        term: "**Đang làm**",
        meaning: "Các việc chưa bấm **Xong**. Đây là mục mở sẵn khi vào trang.",
      },
      {
        term: "**Đã xong**",
        meaning: "Các việc đã bấm **Xong**.",
      },
      {
        term: "**Tất cả**",
        meaning:
          "Mọi việc giao cho bạn, gồm cả việc đã xong và việc Giám đốc đã hủy. Việc đã hủy hiện mờ, không có nút.",
      },
      {
        term: "Hạn",
        meaning:
          "Hết ngày làm việc theo giờ Việt Nam (23 giờ 59). Ngày ghi theo dạng năm-tháng-ngày, ví dụ 2026-09-15.",
      },
      {
        term: "**Quá hạn**",
        meaning:
          "Chữ đỏ, kèm ngày hạn: đã qua hết ngày hạn mà việc chưa bấm **Xong**.",
      },
      {
        term: "**Hạn hôm nay**",
        meaning: "Chữ vàng, kèm ngày: việc phải xong trước hết ngày hôm nay.",
      },
      {
        term: "**Không hạn**",
        meaning: "Việc không đặt hạn. Việc này không có tin nhắc hạn.",
      },
      {
        term: "!",
        meaning: "Dấu chấm than màu đỏ trước tên việc: việc ưu tiên cao.",
      },
      {
        term: "**Người giao**",
        meaning:
          "Tên người đã giao việc cho bạn. Việc bạn tự giao cho mình thì không có dòng này.",
      },
      {
        term: "Mã đơn",
        meaning:
          "Mã đơn hàng liên quan đến việc, ví dụ RD-20260905-K7QM, hiện khi việc gắn với một đơn.",
      },
      {
        term: "**Xong lúc**",
        meaning: "Ngày giờ việc được bấm **Xong**.",
      },
      {
        term: "**Hạn mới**, **Lý do**",
        meaning:
          "Hai ô bắt buộc khi xin gia hạn: ngày bạn muốn dời hạn tới và lý do cần thêm thời gian.",
      },
      {
        term: "**Đang chờ Giám đốc duyệt: xin dời sang**",
        meaning:
          "Yêu cầu gia hạn đã gửi và chưa được trả lời. Trong lúc này không gửi được yêu cầu thứ hai cho cùng việc.",
      },
      {
        term: "**Giám đốc đã duyệt gia hạn tới** / **Giám đốc không duyệt gia hạn tới**",
        meaning:
          "Câu trả lời cho yêu cầu gia hạn gần nhất, kèm ngày đã xin và **Ghi chú** của Giám đốc nếu có.",
      },
      {
        term: "Zalo OA",
        meaning:
          "OA là viết tắt của “Official Account”, tức tài khoản Zalo chính thức của công ty. Bạn gửi mã liên kết cho tài khoản này.",
      },
      {
        term: "Mã liên kết",
        meaning:
          "Mã dạng RD- và 6 ký tự, ví dụ RD-7K3M9Q. Mã chỉ dùng được trong 15 phút và chỉ cho tài khoản của bạn.",
      },
      {
        term: "**Đã liên kết Zalo** / **Chưa liên kết**",
        meaning:
          "Cho biết tài khoản của bạn đã được gắn với một tài khoản Zalo hay chưa.",
      },
    ],
    tips: [
      {
        text: "Bấm **Xong** ngay khi làm xong để không nhận tin nhắc hạn nữa và để Giám đốc thấy đúng tình hình.",
      },
      {
        text: "Xin gia hạn sớm, trước khi hạn qua, và ghi lý do cụ thể (ví dụ “chờ nhà cung cấp giao sơn đến ngày 18”). Việc vẫn tính là quá hạn nếu hạn cũ đã qua trong lúc chờ duyệt.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Việc bạn tự giao cho mình cũng hiện ở đây. Muốn đổi hạn việc đó, hãy sửa trực tiếp ở **Giao việc** thay vì bấm **Xin gia hạn**, vì yêu cầu xin gia hạn cũng sẽ về chính bạn.",
        roles: ["DIRECTOR"],
      },
      {
        text: "Tin nhắc hạn hằng ngày có đường link đến màn hình **Giao việc**, là màn hình chỉ Giám đốc mở được. Nếu link trong tin nhắc hạn báo không tìm thấy trang, hãy bấm **Công việc được giao** trong menu để xem việc.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
          "CONTENT_CREATOR",
        ],
      },
      {
        text: "Việc quá hạn được nhắc mỗi ngày cho tới khi bạn bấm **Xong**.",
      },
      {
        text: "Theo cài đặt mặc định, tin nhắn lúc đêm (từ 21 giờ đến 7 giờ sáng) được giữ lại và gửi vào buổi sáng.",
      },
      {
        text: "Dòng vàng “Đã đánh dấu xong.”, “Đã gửi yêu cầu gia hạn cho Giám đốc.”, “Đã tạo mã liên kết Zalo.”, “Đã gỡ liên kết Zalo.” hoặc “Đã cập nhật.” nghĩa là thao tác đã được lưu.",
      },
      {
        text: "Dòng đỏ luôn bắt đầu bằng “Thao tác không thành công:”, rồi đến lý do. Các lý do hay gặp được giải thích ngay dưới đây.",
      },
      {
        text: "“Việc này đã có một yêu cầu đang chờ duyệt.”: bạn đã gửi yêu cầu gia hạn cho việc này rồi. Hãy chờ Giám đốc trả lời.",
      },
      {
        text: "“Hạn mới phải là một ngày trong tương lai và khác hạn cũ.”: chọn lại một ngày từ ngày mai trở đi và không trùng hạn hiện tại.",
      },
      {
        text: "“Bản ghi đã thay đổi; trang đã tải lại, kiểm tra rồi thử lại.”: việc vừa được sửa (ví dụ Giám đốc đổi hạn). Đọc lại thẻ rồi thao tác lại nếu vẫn cần.",
      },
      {
        text: "“Trạng thái hiện tại không cho phép thao tác này.”: việc đã xong hoặc đã bị hủy nên không bấm **Xong** hay xin gia hạn được nữa.",
      },
      {
        text: "“Chỉ người được giao việc mới xin gia hạn được.”: việc đã được chuyển cho người khác. Tải lại trang để xem danh sách mới.",
      },
      {
        text: "“Không tìm thấy bản ghi.”: việc không còn tồn tại. “Bạn không có quyền thực hiện thao tác này.”, “Dữ liệu nhập chưa hợp lệ.”: kiểm tra lại ô đã nhập, rồi báo Giám đốc nếu vẫn lỗi. “Chức năng chưa được cấu hình trên máy chủ.” hoặc “Hệ thống tạm thời không phản hồi.”: chờ một lát rồi thử lại.",
      },
      {
        text: "Nếu khung Zalo ghi “Zalo OA chưa được cấu hình trên máy chủ; mã có thể lấy nhưng chưa xác minh được.”, việc liên kết Zalo chưa hoạt động. Bạn vẫn nhận tin qua email.",
      },
      {
        text: "Mã hết hạn sau 15 phút. Mỗi lần bấm **Lấy mã liên kết**, mã cũ bị hủy và mã mới thay thế, nên chỉ gửi mã mới nhất đang hiện trên màn hình.",
      },
      {
        text: "Nếu Zalo OA trả lời “Red Door: mã không hợp lệ hoặc đã hết hạn…”, hãy lấy mã mới ở khung **Zalo của tôi** trên màn hình này (tin nhắn còn ghi tên cũ là “Việc cần làm → Liên kết Zalo”).",
      },
      {
        text: "Nếu Zalo OA trả lời “Red Door: Zalo này đã liên kết với một tài khoản khác. Hãy gỡ liên kết cũ trên cổng quản trị trước.”, tài khoản Zalo đó đang gắn với một tài khoản website khác. Người đó phải bấm **Gỡ liên kết** trước.",
      },
      {
        text: "Hãy gửi mã từ chính tài khoản Zalo của bạn. Tin sẽ về tài khoản Zalo đã gửi mã.",
      },
    ],
  },
];
