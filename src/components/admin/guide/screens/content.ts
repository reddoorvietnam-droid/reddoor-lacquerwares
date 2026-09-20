import type { ScreenGuide } from "../guide-types";

export const contentScreens: readonly ScreenGuide[] = [
  /* ------------------------------------------------------------------ */
  /* Nội dung                                                            */
  /* ------------------------------------------------------------------ */
  {
    path: "/content",
    title: "Nội dung",
    summary:
      "Nơi soạn các đoạn nội dung thương hiệu dùng trên website, như các bước trong quy trình làm sơn mài và các mốc lịch sử. Mỗi nội dung đi qua bản nháp, gửi duyệt rồi mới xuất bản.",
    layout: [
      {
        text: "Đầu trang có tiêu đề **Nội dung thương hiệu** và nút **Tạo nội dung** ở góc phải.",
      },
      {
        text: "Ô **Tìm nội dung** lọc ngay danh sách theo mã, tiêu đề, loại hoặc vị trí khi bạn gõ.",
      },
      {
        text: "Bảng danh sách có các cột **Nội dung** (tiêu đề, bên dưới là mã và loại), **Vị trí**, **Quy trình**, **Bản dịch**, **Cập nhật** và **Thao tác** với nút **Biên tập**.",
      },
      {
        text: "Bấm **Tạo nội dung** mở trang **Tạo nội dung có cấu trúc**; bấm **Biên tập** mở trang **Cập nhật nội dung có cấu trúc** của dòng đó.",
      },
      {
        text: "Trang soạn có khung **Thông tin chung** (**Mã nội dung**, **Vị trí hiển thị**, **Loại nội dung**, **Ngôn ngữ nguồn**) và khung **Sáu bản dịch** với sáu nút chọn ngôn ngữ.",
      },
      {
        text: "Trong mỗi bản dịch có **Tiêu đề**, **Slug**, **Tóm tắt**, **Nội dung văn bản** và phần **SEO** (**Tiêu đề SEO**, **Mô tả SEO**, ô đánh dấu **Không cho công cụ tìm kiếm index bản dịch này**). Góc phải mỗi bản dịch có nhãn trạng thái riêng.",
      },
      {
        text: "Cuối trang soạn là nút **Lưu bản nháp**. Với nội dung đã có, bên dưới còn khung **Cổng kiểm soát xuất bản** chứa các nút chuyển trạng thái.",
      },
    ],
    capabilities: [
      { text: "Tìm nhanh một nội dung bằng ô **Tìm nội dung**." },
      {
        text: "Tạo nội dung mới: đặt **Mã nội dung**, **Vị trí hiển thị**, chọn **Loại nội dung** và **Ngôn ngữ nguồn**, rồi nhập bản dịch.",
      },
      {
        text: "Nhập tới sáu bản dịch. Bản dịch nào để trống **Tiêu đề** thì không được lưu.",
      },
      {
        text: "Sửa và bấm **Lưu bản nháp** bao nhiêu lần tùy ý khi nội dung đang ở **Bản nháp**.",
      },
      {
        text: "Bấm **Gửi duyệt** để chuyển bản nháp sang **Đang duyệt**.",
      },
      {
        text: "Khi nội dung **Đang duyệt**: ghi **Lý do cần chỉnh sửa** rồi bấm **Trả về bản nháp**, hoặc bấm **Duyệt và xuất bản** để đưa lên website.",
      },
      {
        text: "Khi nội dung **Đã xuất bản**: bấm **Tạo revision mới** để có một bản nháp mới chép từ bản đang chạy trên website, sửa tiếp mà website vẫn giữ bản cũ.",
      },
      {
        text: "Bạn tự làm được cả ba bước gửi duyệt, trả về và xuất bản; không cần chờ Giám đốc duyệt.",
      },
    ],
    limits: [
      {
        text: "Màn hình này không có nút xóa hay nút lưu trữ nội dung.",
      },
      {
        text: "Không đổi được **Mã nội dung** sau khi đã tạo (ô bị khóa). Ô **Loại nội dung** vẫn chọn được ở trang biên tập, nhưng chỉ lần tạo mới là có tác dụng; đổi sau đó không được lưu.",
      },
      {
        text: "Không sửa trực tiếp được nội dung **Đã xuất bản**: nút **Lưu bản nháp** bị mờ. Phải bấm **Tạo revision mới** trước.",
      },
      {
        text: "Không sửa được nội dung **Đang duyệt**: phải bấm **Trả về bản nháp** trước rồi mới sửa và lưu.",
      },
      {
        text: "**Nội dung văn bản** chỉ nhận chữ thường chia đoạn; không in đậm, không chèn ảnh, không chèn mã trang web.",
      },
      {
        text: "Màn hình này không có chỗ tải ảnh. Ảnh của các bước quy trình và mốc lịch sử trên website không đổi được ở đây; nội dung mới tạo sẽ hiện ô ảnh để trống.",
      },
      {
        text: "Khi hiện khung vàng báo bản nháp có loại block chưa được hỗ trợ, nút lưu bị khóa; nội dung đó không sửa được ở màn hình này.",
      },
      {
        text: "Không có thông báo, Zalo hay email nào được gửi khi gửi duyệt, trả về hay xuất bản.",
      },
    ],
    flows: [
      {
        title: "Tạo một nội dung mới",
        when: "Khi website cần thêm một bước quy trình, một mốc lịch sử hay một đoạn nội dung mới.",
        steps: [
          "Bấm **Tạo nội dung**.",
          "Nhập **Mã nội dung** bằng chữ thường không dấu, nối bằng gạch ngang, ví dụ buoc-mai-bong.",
          "Nhập **Vị trí hiển thị**, ví dụ “01 · Làm vóc”.",
          "Chọn **Loại nội dung** và **Ngôn ngữ nguồn**.",
          "Bấm nút ngôn ngữ trùng với **Ngôn ngữ nguồn** và nhập **Tiêu đề**, **Tóm tắt**, **Nội dung văn bản**.",
          "Chuyển sang các nút ngôn ngữ khác nếu có bản dịch; bỏ trống **Tiêu đề** ở ngôn ngữ chưa dịch.",
          "Kiểm tra ô **Không cho công cụ tìm kiếm index bản dịch này** ở từng bản dịch (ô này được đánh dấu sẵn).",
          "Bấm **Lưu bản nháp**.",
        ],
        result:
          "Trang chuyển sang màn hình biên tập, hiện dòng xanh **Đã lưu bản nháp.** Nhãn trạng thái là **Bản nháp**; website chưa thay đổi gì.",
      },
      {
        title: "Gửi duyệt và xuất bản",
        when: "Khi bản nháp đã viết xong và kiểm tra lại.",
        steps: [
          "Mở nội dung bằng nút **Biên tập**.",
          "Kiểm tra lại từng bản dịch và bấm **Lưu bản nháp** nếu vừa sửa.",
          "Kéo xuống khung **Cổng kiểm soát xuất bản**, bấm **Gửi duyệt**.",
          "Chờ dòng xanh **Đã gửi bản nháp để duyệt.** và nhãn đổi thành **Đang duyệt**.",
          "Đọc lại lần cuối.",
          "Bấm **Duyệt và xuất bản**.",
        ],
        result:
          "Bạn được đưa về danh sách, hiện dòng xanh **Đã xuất bản nội dung.** Cột **Quy trình** hiện **Đã xuất bản** và website tự làm mới nội dung.",
      },
      {
        title: "Trả nội dung về bản nháp để sửa",
        when: "Khi nội dung đang **Đang duyệt** nhưng cần chỉnh thêm.",
        steps: [
          "Mở nội dung bằng nút **Biên tập**.",
          "Trong khung **Cổng kiểm soát xuất bản**, ghi vào ô **Lý do cần chỉnh sửa** những gì phải sửa.",
          "Bấm **Trả về bản nháp**.",
          "Sửa nội dung ở phần trên của trang.",
          "Bấm **Lưu bản nháp**.",
          "Bấm **Gửi duyệt** lại khi đã sửa xong.",
        ],
        result:
          "Sau bước 3 hiện dòng xanh **Đã trả nội dung về bản nháp.** và nhãn về **Bản nháp**; nút **Lưu bản nháp** dùng lại được.",
      },
      {
        title: "Sửa một nội dung đang có trên website",
        when: "Khi cần đổi chữ của một nội dung **Đã xuất bản**.",
        steps: [
          "Mở nội dung bằng nút **Biên tập**.",
          "Bấm **Tạo revision mới** trong khung **Cổng kiểm soát xuất bản**.",
          "Kiểm tra nhãn trạng thái đã đổi thành **Bản nháp**.",
          "Sửa các bản dịch cần đổi.",
          "Bấm **Lưu bản nháp**.",
          "Bấm **Gửi duyệt**, rồi **Duyệt và xuất bản**.",
        ],
        result:
          "Trong lúc bạn sửa, website vẫn hiện bản cũ. Chỉ khi bấm **Duyệt và xuất bản** thì bản mới mới thay bản cũ.",
      },
    ],
    terms: [
      {
        term: "Content Studio",
        meaning:
          "Tên gọi khác của khu soạn nội dung, hiện ở dòng chữ nhỏ đầu trang.",
      },
      {
        term: "Bản nháp",
        meaning:
          "Đang soạn, chỉ người trong cổng quản trị thấy. Sửa và lưu thoải mái.",
      },
      {
        term: "Đang duyệt",
        meaning:
          "Đã gửi duyệt, chờ bấm **Duyệt và xuất bản** hoặc **Trả về bản nháp**. Lúc này bấm **Lưu bản nháp** sẽ báo lỗi, không lưu được.",
      },
      {
        term: "Đã xuất bản",
        meaning:
          "Đang hiện trên website. Muốn sửa phải bấm **Tạo revision mới**.",
      },
      {
        term: "Đã lưu trữ",
        meaning:
          "Nội dung đã khóa hẳn, trang biên tập chỉ hiện ghi chú, không có nút nào để thao tác.",
      },
      {
        term: "Cần cập nhật",
        meaning:
          "Nhãn có thể hiện ở một bản dịch, cho biết bản dịch đó cần được xem lại cho khớp với bản nguồn.",
      },
      {
        term: "**revision**",
        meaning:
          "Một lần sửa của nội dung. **Tạo revision mới** nghĩa là mở một bản nháp mới dựa trên bản đang có trên website.",
      },
      {
        term: "Quy trình",
        meaning:
          "Cột cho biết trạng thái chung của nội dung: **Bản nháp**, **Đang duyệt**, **Đã xuất bản** hoặc **Đã lưu trữ**.",
      },
      {
        term: "Bản dịch",
        meaning:
          "Cột hiện số bản dịch đã xuất bản trên tổng số sáu ngôn ngữ, ví dụ 2/6 **bản đã xuất bản**.",
      },
      {
        term: "Mã nội dung",
        meaning:
          "Tên cố định để hệ thống nhận ra nội dung, viết chữ thường không dấu nối bằng gạch ngang. Không đổi theo ngôn ngữ và không sửa được sau khi tạo.",
      },
      {
        term: "Vị trí hiển thị",
        meaning:
          "Nhãn cho biết nội dung nằm ở đâu và đứng thứ mấy. Danh sách các bước quy trình trên website lấy nội dung loại **Công đoạn**, dùng **Vị trí hiển thị** làm nhãn bước và thứ tự (ví dụ “01 · Làm vóc”). Các mốc lịch sử lấy nội dung loại **Section** có **Vị trí hiển thị** bắt đầu bằng chữ history (ví dụ “history.01 · Làng nghề”).",
      },
      {
        term: "Loại nội dung",
        meaning:
          "Gồm **Trang**, **Section** (một đoạn nằm trong trang), **Công đoạn** (một bước quy trình làm hàng) và **Nội dung dùng chung**.",
      },
      {
        term: "Ngôn ngữ nguồn",
        meaning:
          "Ngôn ngữ viết bản gốc. Bản dịch của ngôn ngữ này bắt buộc phải có **Tiêu đề**.",
      },
      {
        term: "Slug",
        meaning:
          "Phần chữ cuối đường dẫn trang, chỉ gồm chữ, số và dấu gạch ngang, không có dấu cách. Chỉ bắt buộc với loại **Trang** và **Công đoạn**: thiếu slug ở bản dịch nào thì không xuất bản được.",
      },
      {
        term: "SEO",
        meaning:
          "Phần chữ hiện trên Google. **Tiêu đề SEO** tối đa 70 ký tự, **Mô tả SEO** tối đa 180 ký tự. Đánh dấu **Không cho công cụ tìm kiếm index bản dịch này** thì Google không đưa bản dịch đó vào kết quả tìm kiếm.",
      },
    ],
    tips: [
      {
        text: "Ở danh sách các bước quy trình và các mốc lịch sử, website lấy **Tiêu đề** và **Tóm tắt** của bản dịch đã xuất bản. Hãy viết hai ô này thật gọn.",
      },
      {
        text: "Trong **Nội dung văn bản**, để một dòng trống giữa hai đoạn thì hệ thống lưu thành hai đoạn riêng.",
      },
      {
        text: "Với nội dung mới, ô **Không cho công cụ tìm kiếm index bản dịch này** được đánh dấu sẵn. Bỏ dấu ở bản dịch nào muốn Google tìm thấy.",
      },
      {
        text: "Bấm **Lưu bản nháp** mà không có gì xảy ra: kiểm tra **Mã nội dung** (không để trống, chỉ chữ thường không dấu, số và gạch ngang), **Vị trí hiển thị** (không để trống) và **Slug** ở từng bản dịch (không có dấu cách).",
      },
      {
        text: "Dòng xanh **Đã lưu bản nháp.**, **Đã gửi bản nháp để duyệt.**, **Đã trả nội dung về bản nháp.**, **Đã xuất bản nội dung.** nghĩa là thao tác đã xong.",
      },
      {
        text: "Dòng đỏ **Một số trường chưa hợp lệ. Kiểm tra nội dung và thử lại.**: thường do bản dịch nguồn thiếu **Tiêu đề**, bản dịch có nội dung mà chưa có **Tiêu đề**, **Lý do cần chỉnh sửa** chỉ có dấu cách, nội dung loại **Trang**/**Công đoạn** thiếu **Slug** khi xuất bản, hoặc bấm **Lưu bản nháp** khi nội dung đang **Đang duyệt**.",
      },
      {
        text: "Dòng đỏ **Nội dung đã thay đổi ở một phiên khác. Tải lại trang trước khi tiếp tục.**: có người khác (hoặc chính bạn ở tab khác) vừa sửa; hãy chép phần mình đang gõ ra ngoài, tải lại trang rồi nhập lại. Thông báo này cũng hiện khi mã nội dung trùng với một nội dung khác.",
      },
      {
        text: "Dòng đỏ **Dữ liệu đã được lưu, nhưng audit hoặc làm mới cache chưa hoàn tất. Không gửi lại thao tác; hãy báo quản trị viên.**: đừng bấm lại, báo cho bộ phận kỹ thuật.",
      },
      {
        text: "Dòng đỏ **Không tìm thấy bản nội dung được yêu cầu.** hoặc **Không thể hoàn tất thao tác. Không có dữ liệu nhạy cảm nào được hiển thị.**: tải lại trang và thử lại; nếu vẫn lỗi, báo kỹ thuật.",
      },
      {
        text: "Sau khi xuất bản, website tự làm mới; nếu chưa thấy thay đổi, tải lại trang website một lần.",
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* Theo dõi tiến độ mẫu                                                */
  /* ------------------------------------------------------------------ */
  {
    path: "/sample-progress",
    title: "Theo dõi tiến độ mẫu",
    summary:
      "Báo cáo tiến độ đơn hàng mẫu hằng tuần, thay cho file Excel trước đây. Bạn cập nhật trực tiếp trên web; Giám đốc mở xem ngay, không cần gửi file.",
    layout: [
      {
        text: "Đầu trang ghi tuần đang mở, số phiên bản, người lưu và giờ lưu. Nếu có thay đổi chưa lưu sẽ thêm chữ **Có thay đổi chưa lưu.** Tuần kế thừa có thêm dòng “Tuần này được kế thừa từ tuần …”.",
      },
      {
        text: "Khung chọn tuần: ô **Báo cáo đã lưu**, ô ngày **Mở hoặc tạo tuần khác**, nút **Kế thừa sang tuần mới** và nút **Nhập Excel**.",
      },
      {
        text: "Khung thống kê: biểu đồ tròn và bốn thẻ đếm số mẫu, tỷ lệ phần trăm theo từng trạng thái.",
      },
      {
        text: "Thanh lọc: ô **Tìm mẫu**, ô **Lọc trạng thái**, ô **Sắp xếp**, nút **Xóa bộ lọc**, nút **Thêm mẫu** và dòng **Hiển thị x/y mẫu**.",
      },
      {
        text: "Bảng chi tiết chín cột như file Excel, thêm cột **Người cập nhật**, **Cập nhật lúc** và cột **Thao tác** (nút **Sửa**, **Bỏ mẫu**) ghim ở mép phải.",
      },
      {
        text: "Khung cuối trang: ô **Nội dung cập nhật lần này (bắt buộc khi lưu)**, ô **Ngày báo cáo**, các nút **Lưu báo cáo**, **Xuất Excel**, **In báo cáo**, **Xóa báo cáo tuần này**, **Lịch sử chỉnh sửa**.",
      },
      {
        text: "Dòng xanh báo kết quả, dòng đỏ báo lỗi và các khung xác nhận (kế thừa, bỏ mẫu, hủy nhập file, xóa tuần, bỏ thay đổi) hiện ngay trên trang, phía dưới khung chọn tuần.",
      },
    ],
    capabilities: [
      { text: "Mở báo cáo của một tuần đã lưu bằng ô **Báo cáo đã lưu**." },
      {
        text: "Mở hoặc tạo báo cáo cho tuần khác bằng cách chọn một ngày bất kỳ trong tuần ở ô **Mở hoặc tạo tuần khác**.",
      },
      {
        text: "Chép toàn bộ mẫu của tuần đang mở sang tuần kế tiếp bằng **Kế thừa sang tuần mới**.",
      },
      {
        text: "Đọc file Excel (.xlsx hoặc .xlsm, tối đa 2 MB) bằng **Nhập Excel**, xem trước rồi mới lưu.",
      },
      {
        text: "Thêm mẫu, sửa từng mẫu, bỏ mẫu khỏi bản đang soạn. Đang sửa mà đổi ý thì bấm **Hủy chỉnh sửa mẫu**.",
      },
      {
        text: "Tìm, lọc theo trạng thái, sắp xếp theo **Thứ tự báo cáo** hoặc **Cập nhật gần nhất**. Lọc chỉ đổi phần hiển thị, không đổi dữ liệu.",
      },
      {
        text: "Lưu báo cáo thành một phiên bản mới, có ghi người lưu và thời gian.",
      },
      {
        text: "Xem lại mọi phiên bản cũ của tuần bằng **Lịch sử chỉnh sửa**.",
      },
      {
        text: "Tải file Excel của phiên bản đang xem và in báo cáo (có thể chọn lưu thành PDF trong hộp thoại in).",
      },
      {
        text: "Xóa toàn bộ báo cáo của một tuần khi lỡ lưu nhầm, kèm lý do bắt buộc.",
      },
    ],
    limits: [
      {
        text: "Không sửa hay xóa riêng một phiên bản cũ. Phiên bản cũ chỉ để xem.",
      },
      {
        text: "Xóa tuần là xóa cả tuần, mọi mẫu và mọi phiên bản. Hệ thống giữ một bản sao, nhưng không tự khôi phục trên web được; phải nhờ bộ phận kỹ thuật.",
      },
      {
        text: "**Xuất Excel** và **Xóa báo cáo tuần này** bị mờ khi còn thay đổi chưa lưu hoặc đang sửa dở một mẫu.",
      },
      {
        text: "**Kế thừa sang tuần mới** bị mờ khi tuần đang mở chưa được lưu lần nào. Không kế thừa được nếu tuần kế tiếp đã có báo cáo.",
      },
      {
        text: "Mỗi báo cáo tối đa 500 mẫu; khi đủ 500, nút **Thêm mẫu** bị mờ.",
      },
      {
        text: "Chỉ bạn và Giám đốc mở được màn hình này; các vị trí khác không thấy mục này. Giám đốc cũng sửa và lưu được như bạn.",
      },
      {
        text: "File Excel bạn chọn khi nhập không được lưu lại ở đâu; chỉ dữ liệu trong bảng được lưu khi bấm **Lưu báo cáo**.",
      },
    ],
    flows: [
      {
        title: "Nhập file Excel",
        when: "Khi chuyển báo cáo đang làm bằng Excel lên web.",
        steps: [
          "Bấm **Nhập Excel** và chọn file .xlsx hoặc .xlsm.",
          "Đọc dòng xanh cho biết số mẫu đã đọc và tuần của báo cáo (lấy theo ngày báo cáo ghi trong file).",
          "Đọc khung vàng **Đang xem trước file … — chưa lưu vào hệ thống**: số mẫu, số lỗi, số cảnh báo.",
          "Bấm **Xem … ghi chú khi đọc file** để đọc từng lỗi và cảnh báo.",
          "Tìm các dòng tô vàng trong bảng, bấm **Sửa** để sửa những dòng bị lỗi.",
          "Nhập **Nội dung cập nhật lần này (bắt buộc khi lưu)**, ví dụ “Nhập file Excel tuần 35”.",
          "Kiểm tra **Ngày báo cáo**.",
          "Bấm **Lưu báo cáo**.",
        ],
        result:
          "Hiện dòng xanh “Đã lưu … mẫu · phiên bản … · (giờ lưu).”. Tuần xuất hiện trong ô **Báo cáo đã lưu** và Giám đốc xem được ngay. Nếu tuần đó đã có báo cáo, dữ liệu trong file thay toàn bộ bảng và được lưu thành phiên bản tiếp theo.",
      },
      {
        title: "Hủy file vừa nhập nhầm",
        when: "Khi chọn nhầm file ở **Nhập Excel** và chưa bấm lưu.",
        steps: [
          "Bấm **Hủy nhập file** ở khung vàng.",
          "Đọc khung xác nhận hiện ra.",
          "Bấm **Hủy nhập file** lần nữa để bỏ dữ liệu vừa đọc (hoặc **Giữ lại dữ liệu vừa đọc** nếu đổi ý).",
        ],
        result:
          "Bảng quay lại đúng như trước khi nhập; không có gì được ghi vào hệ thống.",
      },
      {
        title: "Lập báo cáo tuần mới từ tuần trước",
        when: "Đầu mỗi tuần.",
        steps: [
          "Chọn tuần trước trong ô **Báo cáo đã lưu**.",
          "Bấm **Kế thừa sang tuần mới**.",
          "Kiểm tra tuần nguồn và tuần đích trong khung xác nhận.",
          "Bấm **Xác nhận kế thừa** (hoặc **Hủy**).",
          "Cập nhật các mẫu có thay đổi (xem việc “Cập nhật một mẫu”).",
          "Nhập **Nội dung cập nhật lần này (bắt buộc khi lưu)**.",
          "Bấm **Lưu báo cáo**.",
        ],
        result:
          "Tuần mới được tạo ngay ở phiên bản 1 với toàn bộ mẫu của tuần trước; lần lưu ở bước 7 tạo phiên bản 2.",
      },
      {
        title: "Tạo báo cáo cho một tuần trống",
        when: "Khi cần báo cáo cho tuần chưa có và không muốn kế thừa.",
        steps: [
          "Chọn một ngày trong tuần đó ở ô **Mở hoặc tạo tuần khác**.",
          "Bấm **Thêm mẫu** hoặc **Nhập Excel** để đưa mẫu vào.",
          "Nhập **Nội dung cập nhật lần này (bắt buộc khi lưu)**.",
          "Bấm **Lưu báo cáo**.",
        ],
        result:
          "Nếu tuần đã có báo cáo, hệ thống mở báo cáo đó thay vì tạo mới. Nếu chưa có, bảng trống hiện ra và chỉ được ghi khi bấm **Lưu báo cáo**.",
      },
      {
        title: "Cập nhật một mẫu",
        when: "Khi mẫu đổi trạng thái, đổi nơi làm, có ngày nhận, ngày kiểm hay ngày gửi.",
        steps: [
          "Bấm **Sửa** ở dòng mẫu (dùng ô **Tìm mẫu** nếu bảng dài).",
          "Trong khung **Cập nhật mẫu**, chọn **Trạng thái tổng thể** mới.",
          "Sửa **Nơi làm**, **Chi tiết tiến độ / ghi chú nhật ký** nếu cần.",
          "Ở mỗi cột ngày, chọn **Chưa có**, **Ngày cụ thể** (rồi chọn ngày) hoặc **Ghi chú (VD: Chờ gửi)** (rồi gõ chữ).",
          "Bấm **Áp dụng vào bảng**.",
          "Lặp lại cho các mẫu khác.",
          "Nhập **Nội dung cập nhật lần này (bắt buộc khi lưu)**.",
          "Bấm **Lưu báo cáo**.",
        ],
        result:
          "Mỗi lần lưu tạo một phiên bản mới; cột **Cập nhật lúc** của những mẫu đã đổi ghi thời gian lưu.",
      },
      {
        title: "Thêm hoặc bỏ một mẫu",
        steps: [
          "Để thêm: bấm **Thêm mẫu**, điền **STT**, **Mẫu đơn hàng** (bắt buộc) và các ô khác trong khung **Thêm mẫu mới**, rồi bấm **Áp dụng vào bảng**.",
          "Để bỏ: bấm **Bỏ mẫu** ở dòng mẫu, rồi bấm **Bỏ mẫu** trong khung xác nhận (hoặc **Giữ lại**).",
          "Nhập **Nội dung cập nhật lần này (bắt buộc khi lưu)**.",
          "Bấm **Lưu báo cáo**.",
        ],
        result:
          "Mẫu bị bỏ chỉ mất khỏi phiên bản mới; các phiên bản đã lưu trước đó vẫn giữ mẫu này.",
      },
      {
        title: "Xem lại một phiên bản cũ",
        steps: [
          "Mở tuần cần xem.",
          "Bấm **Lịch sử chỉnh sửa**.",
          "Trong bảng lịch sử, bấm **Xem phiên bản …** ở dòng muốn xem.",
          "Đọc hoặc bấm **Xuất Excel**, **In báo cáo** nếu cần.",
          "Bấm **Mở phiên bản mới nhất** trong khung vàng để quay lại bản đang dùng.",
        ],
        result: "Phiên bản cũ chỉ để xem, không có nút sửa hay lưu.",
      },
      {
        title: "Xuất Excel và in báo cáo",
        steps: [
          "Mở tuần và phiên bản cần xuất; bảo đảm đã lưu hết thay đổi.",
          "Bấm **Xuất Excel** để tải file của đúng phiên bản đang xem.",
          "Muốn in: đặt bộ lọc nếu chỉ cần in một phần, rồi bấm **In báo cáo**.",
          "Trong hộp thoại in của trình duyệt, chọn máy in hoặc chọn lưu thành PDF.",
        ],
        result:
          "File Excel luôn gồm toàn bộ mẫu của phiên bản đã lưu; bản in theo bộ lọc đang chọn.",
      },
      {
        title: "Xóa báo cáo của một tuần lưu nhầm",
        when: "Khi đã lỡ lưu nhầm file hoặc nhầm tuần.",
        steps: [
          "Mở tuần cần xóa, bảo đảm không còn thay đổi chưa lưu.",
          "Bấm **Xóa báo cáo tuần này** ở khung cuối trang.",
          "Đọc kỹ số mẫu và số phiên bản sẽ bị xóa.",
          "Ghi **Lý do xóa (bắt buộc)**, ít nhất 5 ký tự.",
          "Bấm **Xóa báo cáo tuần này** trong khung xác nhận (hoặc **Giữ lại báo cáo**).",
        ],
        result:
          "Cả tuần biến mất khỏi danh sách của bạn và của Giám đốc; trang tự mở tuần mới nhất còn lại. Có thể nhập lại file khác cho tuần đó từ đầu.",
      },
    ],
    terms: [
      {
        term: "1. Đang làm mộc/vóc",
        meaning:
          "Trạng thái đầu tiên, mẫu đang ở công đoạn làm mộc hoặc làm vóc (màu đỏ). Mẫu mới thêm mặc định ở trạng thái này.",
      },
      {
        term: "2. Đang hoàn thiện",
        meaning: "Mẫu đang ở công đoạn hoàn thiện (màu vàng cam).",
      },
      {
        term: "3. Đã kiểm duyệt (QC Đạt)",
        meaning: "Mẫu đã qua kiểm tra chất lượng và đạt (màu xanh lá).",
      },
      {
        term: "4. Đã gửi mẫu",
        meaning: "Mẫu đã được gửi đi (màu xanh dương).",
      },
      {
        term: "QC",
        meaning:
          "Kiểm tra chất lượng. Cột **Ngày kiểm (QC)** là ngày mẫu được kiểm.",
      },
      {
        term: "Excel",
        meaning:
          "Phần mềm bảng tính. Web chỉ dùng file Excel để nhập dữ liệu cũ và xuất báo cáo khi cần gửi ra ngoài hoặc lưu trữ.",
      },
      {
        term: "PDF",
        meaning:
          "Định dạng file tài liệu. Muốn có bản PDF, chọn lưu thành PDF trong hộp thoại in.",
      },
      {
        term: "Phiên bản",
        meaning:
          "Mỗi lần bấm **Lưu báo cáo** tạo một phiên bản mới của tuần (v1, v2…). Phiên bản cũ giữ nguyên, xem lại được.",
      },
      {
        term: "Tuần",
        meaning:
          "Tính từ thứ Hai đến Chủ nhật theo giờ Việt Nam. **Ngày báo cáo** phải nằm trong tuần đang mở.",
      },
      {
        term: "Kế thừa",
        meaning:
          "Chép toàn bộ mẫu của tuần đang mở sang tuần kế tiếp làm phiên bản 1; lịch sử của tuần cũ không bị chép.",
      },
      {
        term: "Nội dung cập nhật lần này",
        meaning:
          "Một câu tóm tắt lần lưu này đổi gì, hiện trong **Lịch sử chỉnh sửa**. Không thay cho cột ghi chú của từng mẫu.",
      },
      {
        term: "Cập nhật lúc",
        meaning:
          "Lần gần nhất nội dung của chính mẫu đó thay đổi, không phải lúc lưu báo cáo. Hiện **Chưa lưu** với mẫu vừa sửa trên màn hình mà chưa bấm lưu.",
      },
      {
        term: "Tỷ lệ",
        meaning:
          "Phần trăm số dòng mẫu ở mỗi trạng thái trên tổng số dòng, không phải mức độ hoàn thành. Tổng số mẫu đếm theo dòng, không cộng số lượng ghi trong mô tả.",
      },
      {
        term: "Lỗi và cảnh báo khi nhập file",
        meaning:
          "Lỗi (ví dụ trạng thái lạ, thiếu tên mẫu, trùng STT) phải sửa xong mới lưu được. Cảnh báo (ví dụ ngày dễ bị đọc ngược ngày/tháng, được giữ nguyên dạng chữ) chỉ để bạn kiểm tra lại.",
      },
    ],
    tips: [
      {
        text: "Sửa xong một mẫu phải bấm **Áp dụng vào bảng**; sửa xong cả bảng phải bấm **Lưu báo cáo**. Chưa lưu thì Giám đốc chưa thấy gì.",
      },
      {
        text: "Nút **Lưu báo cáo** bị mờ khi: chưa có thay đổi, còn một mẫu đang sửa dở, chưa nhập **Nội dung cập nhật lần này (bắt buộc khi lưu)**, hoặc còn dòng lỗi từ file Excel. Dòng chữ nhỏ dưới các nút nhắc khi còn mẫu đang sửa dở hoặc còn dòng lỗi.",
      },
      {
        text: "Khi bạn chuyển tuần hay nhập file mà còn thay đổi chưa lưu, khung “Bản đang soạn có thay đổi chưa lưu” hiện ra: bấm **Quay lại chỉnh sửa** để giữ, hoặc **Bỏ thay đổi và tiếp tục**.",
      },
      {
        text: "Khi nhập file mà hiện cảnh báo “Không đọc được ngày báo cáo trong file…”: file không có ngày báo cáo, hãy kiểm tra kỹ tuần đang mở và ô **Ngày báo cáo** trước khi lưu.",
      },
      {
        text: "Dòng đỏ “Người khác vừa lưu phiên bản … của tuần này…”: Giám đốc hoặc một tab khác vừa lưu trước bạn. Nội dung bạn đang nhập vẫn còn trên màn hình; hãy ghi lại phần mình vừa sửa, bấm **Mở lại bản mới nhất**, nhập lại rồi lưu.",
      },
      {
        text: "Dòng đỏ “Tuần … đã có báo cáo (phiên bản …). Hãy mở tuần đó để cập nhật thay vì kế thừa lại.”: tuần kế tiếp đã có, hãy chọn tuần đó trong **Báo cáo đã lưu**.",
      },
      {
        text: "Dòng đỏ “Chọn file .xlsx hoặc .xlsm, dung lượng tối đa 2 MB.”: file sai định dạng hoặc quá lớn. Dòng đỏ “File không có mẫu nào để nhập.”: file không có dòng mẫu nào.",
      },
      {
        text: "Dòng đỏ “Mất kết nối tới máy chủ…”: kiểm tra mạng rồi thử lại; nội dung đang nhập vẫn giữ trên màn hình.",
      },
      {
        text: "Dòng đỏ “STT này đã có trong báo cáo. Hãy chọn số khác.” trong khung sửa mẫu: hai mẫu không được trùng **STT**.",
      },
      {
        text: "Với ô ngày chưa rõ (ví dụ “Chờ gửi”), chọn **Ghi chú (VD: Chờ gửi)** thay vì gõ một ngày giả.",
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* Sản phẩm                                                            */
  /* ------------------------------------------------------------------ */
  {
    path: "/products",
    title: "Sản phẩm",
    summary:
      "Nơi tạo và cập nhật sản phẩm song ngữ Việt–Anh, tải ảnh, gắn bộ sưu tập và xuất bản lên catalogue trên website.",
    layout: [
      {
        text: "Đầu trang có tiêu đề **Quản lý sản phẩm** và nút **Thêm sản phẩm**.",
      },
      {
        text: "Mỗi dòng sản phẩm có: ảnh nhỏ (ảnh chính), tên tiếng Việt, mã SKU, trạng thái, ngày cập nhật, nút **Biên tập** và nút **Xóa**.",
      },
      {
        text: "Trang soạn sản phẩm (mở từ **Thêm sản phẩm** hoặc **Biên tập**) có bốn khung: **Định danh**, **Thông số**, **Thư viện ảnh**, **Bản dịch**.",
      },
      {
        text: "Khung **Định danh**: **Mã SKU**, **Thuộc bộ sưu tập** (ô đánh dấu từng bộ), **Danh mục**, **Nhóm trưng bày**, ô **Đang có sẵn hàng**.",
      },
      {
        text: "Khung **Thông số**: **Chất liệu (phân cách bằng dấu phẩy)**, **Hoàn thiện (phân cách bằng dấu phẩy)**, **Màu (phân cách bằng dấu phẩy)**, **Thời gian sản xuất (ngày)**, **Kích thước (D × R × C)** kèm chọn cm hoặc mm.",
      },
      {
        text: "Khung **Bản dịch** có hai nút VI và EN; mỗi bên có **Tên sản phẩm**, **Slug (tự sinh từ tên)**, **Mô tả ngắn**, **Mô tả chi tiết — mỗi đoạn cách nhau một dòng trống**, **Hướng dẫn bảo quản — mỗi dòng một mục**, **Tiêu đề SEO**, **Mô tả SEO** và ô **Không cho công cụ tìm kiếm index bản dịch này**.",
      },
      {
        text: "Cuối trang soạn: nút **Lưu bản nháp**, nút **Xuất bản** và nút **Xóa sản phẩm** ở bên phải. Thông báo kết quả hiện ngay dưới tên sản phẩm ở đầu trang.",
      },
    ],
    capabilities: [
      { text: "Tạo sản phẩm mới và lưu thành bản nháp." },
      {
        text: "Gắn sản phẩm vào một hay nhiều bộ sưu tập, chọn danh mục (**Khay & mâm**, **Đồ bàn ăn**, **Bình & lọ**, **Hộp & tráp**, **Tranh & panel trang trí**, **Đồ nội thất nhỏ**) và nhóm trưng bày.",
      },
      {
        text: "Bật **Đang có sẵn hàng** để khách xem web thấy nhãn “Có sẵn”.",
      },
      {
        text: "Tải ảnh JPG, PNG hoặc WebP vào **Thư viện ảnh** bằng nút **Thêm ảnh**, gỡ ảnh bằng nút **Gỡ**.",
      },
      {
        text: "Viết bản tiếng Việt (bắt buộc) và bản tiếng Anh (không bắt buộc).",
      },
      {
        text: "Bấm **Xuất bản** để đưa sản phẩm lên website ngay, không cần qua bước duyệt riêng.",
      },
      {
        text: "Sửa mô tả, thông số, bản dịch của sản phẩm đang có trên website: lưu thành bản nháp mới rồi xuất bản lại; website giữ bản cũ cho tới lúc bạn bấm **Xuất bản**.",
      },
      {
        text: "Xóa sản phẩm ở danh sách hoặc trong trang soạn, có bước bấm xác nhận lần hai.",
      },
    ],
    limits: [
      {
        text: "Danh sách không có ô tìm kiếm hay bộ lọc.",
      },
      {
        text: "Không có ô nhập giá: website không hiện giá sản phẩm.",
      },
      {
        text: "Chưa lưu bản nháp lần đầu thì nút **Thêm ảnh** và **Xuất bản** còn mờ.",
      },
      {
        text: "Không kéo đổi thứ tự ảnh được. Ảnh tải lên đầu tiên (có số 1) là ảnh chính. Mỗi sản phẩm tối đa 24 ảnh.",
      },
      {
        text: "Với sản phẩm đã xuất bản, coi như không sửa được khung **Định danh**: lần **Lưu bản nháp** đầu tiên bỏ qua mọi thay đổi ở **Mã SKU**, **Thuộc bộ sưu tập**, **Danh mục**, **Nhóm trưng bày**, **Đang có sẵn hàng** (ô trên màn hình vẫn hiện giá trị bạn vừa chọn). Nếu thật sự cần đổi, báo bộ phận kỹ thuật.",
      },
      {
        text: "Không có nút chuyển sản phẩm sang **Lưu trữ** hay **Ngừng bán**, và không có nút trả sản phẩm **Chờ duyệt** về bản nháp trên màn hình này.",
      },
      {
        text: "Xóa sản phẩm là gỡ hẳn khỏi website và xóa luôn ảnh đã tải lên; không có nút khôi phục.",
      },
    ],
    flows: [
      {
        title: "Tạo và xuất bản sản phẩm mới",
        when: "Khi có sản phẩm mới cần đưa lên catalogue.",
        steps: [
          "Bấm **Thêm sản phẩm**.",
          "Nhập **Mã SKU**, đánh dấu **Thuộc bộ sưu tập**, chọn **Danh mục** và **Nhóm trưng bày**.",
          "Điền khung **Thông số**.",
          "Ở khung **Bản dịch**, bấm VI và nhập **Tên sản phẩm**, **Mô tả ngắn**, **Mô tả chi tiết — mỗi đoạn cách nhau một dòng trống**, **Hướng dẫn bảo quản — mỗi dòng một mục**.",
          "Bấm EN và nhập bản tiếng Anh nếu có.",
          "Kiểm tra lại khung **Định danh** thật kỹ, vì sau khi xuất bản các ô này coi như không sửa được.",
          "Bấm **Lưu bản nháp** và chờ chữ **Đã lưu.**",
          "Bấm **Thêm ảnh**, chọn ảnh chính trước, sau đó lần lượt các ảnh còn lại.",
          "Bấm **Xuất bản** và chờ chữ **Đã xuất bản.**",
        ],
        result:
          "Sản phẩm hiện trên catalogue website ở các ngôn ngữ đã nhập; danh sách ghi **Đã xuất bản**.",
      },
      {
        title: "Tải và gỡ ảnh sản phẩm",
        steps: [
          "Mở sản phẩm bằng nút **Biên tập** (sản phẩm phải đã được lưu).",
          "Bấm **Thêm ảnh** và chọn một file JPG, PNG hoặc WebP.",
          "Chờ nút chạy hết **Đang tải…** kèm phần trăm.",
          "Lặp lại cho từng ảnh.",
          "Muốn bỏ một ảnh, bấm **Gỡ** dưới ảnh đó.",
        ],
        result:
          "Ảnh được lưu ngay khi tải xong hoặc khi bấm **Gỡ**, không cần bấm **Lưu bản nháp**. Với sản phẩm đã xuất bản, ảnh mới cũng hiện trên website ngay.",
      },
      {
        title: "Sửa sản phẩm đang có trên website",
        when: "Khi cần đổi mô tả, thông số hay bản dịch của một sản phẩm **Đã xuất bản**.",
        steps: [
          "Bấm **Biên tập** ở dòng sản phẩm.",
          "Sửa khung **Thông số** và **Bản dịch** cần đổi.",
          "Bấm **Lưu bản nháp** một lần.",
          "Kiểm tra đầu trang có dòng **Có bản nháp chưa xuất bản.**",
          "Bấm **Xuất bản**.",
        ],
        result:
          "Trước bước 5 website vẫn hiện bản cũ và danh sách ghi **Đã xuất bản · có nháp mới**. Sau bước 5 bản mới thay bản cũ.",
      },
      {
        title: "Xóa sản phẩm",
        steps: [
          "Bấm **Xóa** ở dòng sản phẩm trong danh sách (hoặc **Xóa sản phẩm** trong trang soạn).",
          "Nút đổi thành **Chắc chắn?** (hoặc **Xóa hẳn? Bấm lần nữa**); bấm thêm lần nữa để xóa.",
          "Muốn thôi, bấm ra chỗ khác trên trang để nút trở lại như cũ.",
        ],
        result:
          "Sản phẩm biến mất khỏi danh sách và khỏi website, ảnh của sản phẩm bị xóa.",
      },
    ],
    terms: [
      {
        term: "SKU",
        meaning:
          "Mã sản phẩm. Hệ thống tự viết hoa; ký tự lạ (dấu cách, chữ có dấu…) được đổi thành gạch ngang. Hai sản phẩm không được trùng SKU.",
      },
      {
        term: "Bản nháp",
        meaning: "Sản phẩm chưa lên website.",
      },
      {
        term: "Đã xuất bản",
        meaning: "Sản phẩm đang hiện trên website.",
      },
      {
        term: "· có nháp mới",
        meaning:
          "Sản phẩm đang trên website nhưng có bản sửa đã lưu mà chưa xuất bản.",
      },
      {
        term: "Chờ duyệt",
        meaning:
          "Sản phẩm chưa từng lên website mà lần bấm **Xuất bản** bị dừng giữa chừng. Bấm **Xuất bản** lại; nếu vẫn báo lỗi thì sản phẩm không lưu sửa được nữa, báo bộ phận kỹ thuật.",
      },
      {
        term: "Lưu trữ, Ngừng bán",
        meaning:
          "Trạng thái có thể hiện ở danh sách; màn hình này không có nút đặt các trạng thái đó.",
      },
      {
        term: "Nhóm trưng bày",
        meaning:
          "Cách website chia sản phẩm: **Đang sản xuất** hoặc **Đang phát triển**. Không phải trạng thái xuất bản.",
      },
      {
        term: "Danh mục",
        meaning:
          "Họ sản phẩm để khách lọc trên website. Chọn **Chưa phân loại** nếu chưa xếp được.",
      },
      {
        term: "Slug",
        meaning:
          "Phần chữ cuối đường dẫn trang sản phẩm, tự sinh từ tên. Có thể sửa, nhưng không được trùng với sản phẩm khác.",
      },
      {
        term: "SEO",
        meaning:
          "Chữ hiện trên Google. **Tiêu đề SEO** tối đa 70 ký tự, **Mô tả SEO** tối đa 180 ký tự.",
      },
      {
        term: "VI, EN",
        meaning:
          "Bản tiếng Việt và bản tiếng Anh. Bỏ trống bản tiếng Anh thì khách quốc tế đọc bản tiếng Việt.",
      },
      {
        term: "D × R × C",
        meaning: "Dài × Rộng × Cao, đơn vị chọn cm hoặc mm.",
      },
      {
        term: "JPG, PNG, WebP",
        meaning: "Các định dạng ảnh được nhận khi tải lên.",
      },
    ],
    tips: [
      {
        text: "Nút **Lưu bản nháp** mờ khi chưa nhập **Mã SKU** hoặc **Tên sản phẩm** tiếng Việt.",
      },
      {
        text: "Bản tiếng Anh chỉ được lưu khi có **Tên sản phẩm** ở tab EN.",
      },
      {
        text: "Nên tải ảnh chính trước tiên, vì ảnh đầu tiên là ảnh đại diện trên website. Muốn đổi ảnh chính, gỡ các ảnh rồi tải lại theo đúng thứ tự.",
      },
      {
        text: "Chữ vàng **Đã lưu.** hoặc **Đã xuất bản.** ở đầu trang nghĩa là thao tác đã xong.",
      },
      {
        text: "Chữ đỏ **Dữ liệu chưa hợp lệ — kiểm tra các trường bắt buộc.**: kiểm tra lại SKU, tên, các ô số (thời gian sản xuất, kích thước), hoặc sản phẩm đã đủ 24 ảnh.",
      },
      {
        text: "Chữ đỏ **Không thực hiện được. Thử lại sau.** khi lưu: có thể **Mã SKU** đã có ở sản phẩm khác, hoặc mạng chập chờn. Đổi SKU hoặc thử lại sau ít phút.",
      },
      {
        text: "Trước khi bấm **Xuất bản**, kiểm tra **Slug (tự sinh từ tên)** không trùng sản phẩm khác. Nếu hiện chữ đỏ **Đường dẫn đã được dùng ở sản phẩm khác.** thì bản nháp đó bị khóa, không lưu sửa được nữa; báo bộ phận kỹ thuật.",
      },
      {
        text: "Chữ đỏ **Không có bản nháp để xuất bản.**: sản phẩm đã xuất bản và không có gì mới; sửa rồi bấm **Lưu bản nháp** trước.",
      },
      {
        text: "Chữ đỏ **Tải ảnh thất bại — kiểm tra định dạng (JPG/PNG/WebP).**: file không phải JPG, PNG, WebP hoặc quá lớn.",
      },
      {
        text: "Với sản phẩm đã xuất bản: sửa xong chỉ bấm **Lưu bản nháp** một lần rồi bấm **Xuất bản**. Nếu bấm lưu lần nữa mà hiện chữ đỏ **Không thực hiện được. Thử lại sau.** (hay gặp khi đã đổi **Tên sản phẩm**, **Chất liệu**, **Hoàn thiện** hoặc các ô **Định danh**), thì bản đã lưu lần đầu vẫn còn: bấm **Xuất bản** để đưa lên, rồi mới sửa tiếp.",
      },
      {
        text: "Nếu bấm **Xóa** ở danh sách mà sản phẩm không biến mất, tải lại trang và thử lại.",
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* Tin tức                                                             */
  /* ------------------------------------------------------------------ */
  {
    path: "/news",
    title: "Tin tức",
    summary:
      "Nơi viết bài tin tức song ngữ Việt–Anh, gắn danh mục và ảnh đại diện, rồi xuất bản lên trang tin tức của website.",
    layout: [
      {
        text: "Đầu trang có tiêu đề **Quản lý bài viết** và nút **Viết bài mới**.",
      },
      {
        text: "Mỗi dòng bài viết có: tiêu đề tiếng Việt, mã bài viết nhỏ bên dưới, danh mục, trạng thái, ngày cập nhật, nút **Biên tập** và nút **Xóa**.",
      },
      {
        text: "Trang soạn bài có link **← Quay lại danh sách** ở trên cùng, rồi đến các khung **Thông tin chung**, **Nội dung bài viết song ngữ**, **Tiêu đề & SEO**.",
      },
      {
        text: "Khung **Thông tin chung**: **Danh mục**, **Tác giả hiển thị**, **Thẻ (phân cách bằng dấu phẩy)** và **Ảnh đại diện** với nút **Tải ảnh** (hoặc **Thay ảnh**).",
      },
      {
        text: "Khung **Nội dung bài viết song ngữ**: danh sách các khối, mỗi khối có cột **Tiếng Việt** và **English** cạnh nhau, ba nút ↑ (lên), ↓ (xuống), ✕ (xóa khối) ở góc phải. Bên dưới là ô **Thêm khối** với tám nút loại khối.",
      },
      {
        text: "Khung **Tiêu đề & SEO** có hai nút VI và EN; mỗi bên có **Tiêu đề**, **Slug (tự sinh từ tiêu đề)**, **Tóm tắt**, **Tiêu đề SEO**, **Mô tả SEO** và ô **Không cho công cụ tìm kiếm index bản dịch này**.",
      },
      {
        text: "Cuối trang: nút **Lưu bản nháp**, **Xuất bản** và **Xóa bài**. Thông báo kết quả hiện ngay dưới tiêu đề bài ở đầu trang.",
      },
    ],
    capabilities: [
      { text: "Viết bài mới và lưu bản nháp." },
      {
        text: "Chọn danh mục (**Tin tức**, **Từ xưởng**, **Triển lãm & hội chợ**, **Hướng dẫn & bảo quản**), ghi tác giả hiển thị và thẻ.",
      },
      {
        text: "Tải hoặc thay ảnh đại diện (JPG, PNG, WebP).",
      },
      {
        text: "Soạn thân bài bằng các khối **Tiêu đề**, **Đoạn văn**, **Hình ảnh**, **Trích dẫn**, **Danh sách**, **Phân cách**, **Nút CTA**, **Nhúng YouTube**; đổi thứ tự bằng ↑ ↓, xóa khối bằng ✕.",
      },
      {
        text: "Tải ảnh riêng cho từng khối **Hình ảnh**, kèm **Mô tả ảnh (alt)** và **Chú thích**.",
      },
      {
        text: "Bấm **Xuất bản** để đưa bài lên website ngay, không cần qua bước duyệt riêng.",
      },
      {
        text: "Sửa nội dung bài đang có trên website mà website vẫn giữ bản cũ cho tới khi bấm **Xuất bản** lại.",
      },
      {
        text: "Xóa bài ở danh sách hoặc trong trang soạn, có bước bấm xác nhận lần hai.",
      },
    ],
    limits: [
      { text: "Danh sách không có ô tìm kiếm hay bộ lọc." },
      {
        text: "Chưa lưu bản nháp lần đầu thì chưa tải được ảnh đại diện, ảnh trong khối và chưa bấm **Xuất bản** được.",
      },
      {
        text: "Chỉ soạn được hai ngôn ngữ Việt và Anh. Bốn ngôn ngữ còn lại của website tự dùng bản gần nhất.",
      },
      {
        text: "Với bài đã xuất bản, coi như không sửa được **Danh mục**, **Thẻ (phân cách bằng dấu phẩy)**, **Tác giả hiển thị** và **Slug (tự sinh từ tiêu đề)** tiếng Việt: lần **Lưu bản nháp** đầu tiên bỏ qua thay đổi ở ba ô đầu. Nếu thật sự cần đổi, báo bộ phận kỹ thuật.",
      },
      {
        text: "Không có nút chuyển bài sang **Lưu trữ**, và không có nút trả bài **Chờ duyệt** về bản nháp trên màn hình này.",
      },
      {
        text: "Xóa bài là gỡ hẳn khỏi website và xóa luôn mọi ảnh của bài; không có nút khôi phục.",
      },
    ],
    flows: [
      {
        title: "Viết và xuất bản bài mới",
        when: "Khi có tin mới cần đăng.",
        steps: [
          "Bấm **Viết bài mới**.",
          "Chọn **Danh mục**, nhập **Tác giả hiển thị** và **Thẻ (phân cách bằng dấu phẩy)** nếu cần.",
          "Ở khung **Tiêu đề & SEO**, bấm VI và nhập **Tiêu đề**, **Tóm tắt**.",
          "Bấm EN và nhập **Tiêu đề**, **Tóm tắt** tiếng Anh nếu có.",
          "Trong **Thêm khối**, bấm **+ Đoạn văn**, **+ Tiêu đề**… để dựng thân bài và gõ chữ vào cột **Tiếng Việt** và **English**.",
          "Bấm **Lưu bản nháp** và chờ chữ **Đã lưu.**",
          "Bấm **Tải ảnh** ở **Ảnh đại diện** và chọn ảnh.",
          "Thêm khối **+ Hình ảnh** nếu cần, bấm **Tải ảnh cho khối** rồi điền **Mô tả ảnh (alt)**, **Chú thích**.",
          "Bấm **Lưu bản nháp** lần nữa để giữ các khối vừa thêm.",
          "Bấm **Xuất bản** và chờ chữ **Đã xuất bản.**",
        ],
        result:
          "Bài hiện trên trang tin tức của website; danh sách ghi **Đã xuất bản**.",
      },
      {
        title: "Sắp xếp thân bài",
        steps: [
          "Bấm nút loại khối cần thêm trong ô **Thêm khối**; khối mới nằm cuối bài.",
          "Bấm ↑ hoặc ↓ ở góc khối để đưa khối lên hoặc xuống.",
          "Bấm ✕ để bỏ khối không dùng.",
          "Bấm **Lưu bản nháp**.",
        ],
        result:
          "Thứ tự và nội dung các khối chỉ được giữ sau khi bấm **Lưu bản nháp**.",
      },
      {
        title: "Sửa bài đang có trên website",
        when: "Khi cần đổi nội dung một bài **Đã xuất bản**.",
        steps: [
          "Bấm **Biên tập** ở dòng bài viết.",
          "Sửa các khối nội dung, **Tiêu đề**, **Tóm tắt** hoặc bản tiếng Anh.",
          "Bấm **Lưu bản nháp** một lần.",
          "Kiểm tra đầu trang có dòng **Có bản nháp chưa xuất bản.**",
          "Bấm **Xuất bản**.",
        ],
        result:
          "Trước bước 5 website vẫn hiện bản cũ và danh sách ghi **Đã xuất bản · có nháp mới**. Sau bước 5 bản mới thay bản cũ.",
      },
      {
        title: "Thay ảnh đại diện",
        steps: [
          "Mở bài bằng **Biên tập**.",
          "Bấm **Thay ảnh** ở **Ảnh đại diện**.",
          "Chọn file JPG, PNG hoặc WebP và chờ hết **Đang tải…**",
        ],
        result:
          "Ảnh đại diện được lưu ngay, không cần bấm **Lưu bản nháp**; với bài đã xuất bản, website đổi ảnh ngay.",
      },
      {
        title: "Xóa bài viết",
        steps: [
          "Bấm **Xóa** ở dòng bài trong danh sách (hoặc **Xóa bài** trong trang soạn).",
          "Nút đổi thành **Chắc chắn?** (hoặc **Xóa hẳn? Bấm lần nữa**); bấm thêm lần nữa để xóa.",
          "Muốn thôi, bấm ra chỗ khác để nút trở lại như cũ.",
        ],
        result:
          "Bài biến mất khỏi danh sách và khỏi website, ảnh của bài bị xóa.",
      },
    ],
    terms: [
      { term: "Bản nháp", meaning: "Bài chưa lên website." },
      { term: "Đã xuất bản", meaning: "Bài đang hiện trên website." },
      {
        term: "· có nháp mới",
        meaning: "Bài đang trên website và có bản sửa đã lưu mà chưa xuất bản.",
      },
      {
        term: "Chờ duyệt",
        meaning:
          "Bài chưa từng lên website mà lần bấm **Xuất bản** bị dừng giữa chừng. Bấm **Xuất bản** lại; nếu vẫn báo lỗi thì bài không lưu sửa được nữa, báo bộ phận kỹ thuật.",
      },
      {
        term: "Lưu trữ",
        meaning:
          "Trạng thái có thể hiện ở danh sách; màn hình này không có nút đặt trạng thái đó.",
      },
      {
        term: "Khối",
        meaning:
          "Một phần của thân bài. Mỗi khối có cột **Tiếng Việt** và **English**; bỏ trống cột English thì khối dùng bản tiếng Việt.",
      },
      {
        term: "H2, H3",
        meaning:
          "Ở khối **Tiêu đề**, ô **Cấp** chọn tiêu đề mục lớn (H2) hay tiêu đề mục nhỏ (H3).",
      },
      {
        term: "Nút CTA",
        meaning:
          "Nút mời khách bấm, ví dụ “Liên hệ”. Điền **Đường dẫn nút** và **Nhãn nút**.",
      },
      {
        term: "Nhúng YouTube",
        meaning:
          "Khối hiện video YouTube; dán link vào ô **Dán link YouTube**.",
      },
      {
        term: "alt",
        meaning:
          "**Mô tả ảnh (alt)**: một câu ngắn tả ảnh, dùng cho người khiếm thị và cho Google.",
      },
      {
        term: "Slug",
        meaning:
          "Phần chữ cuối đường dẫn bài viết, tự sinh từ tiêu đề; không được trùng với bài khác.",
      },
      {
        term: "SEO",
        meaning:
          "Chữ hiện trên Google. **Tiêu đề SEO** tối đa 70 ký tự, **Mô tả SEO** tối đa 180 ký tự.",
      },
      {
        term: "VI, EN",
        meaning:
          "Bản tiếng Việt và bản tiếng Anh. Bỏ trống bản tiếng Anh thì khách quốc tế đọc bản tiếng Việt.",
      },
    ],
    tips: [
      {
        text: "Nút **Lưu bản nháp** mờ khi chưa có **Tiêu đề** và **Tóm tắt** tiếng Việt.",
      },
      {
        text: "Bản tiếng Anh chỉ được lưu khi tab EN có đủ cả **Tiêu đề** và **Tóm tắt**.",
      },
      {
        text: "Ảnh tải vào khối **Hình ảnh** chỉ nằm trong bài sau khi bấm **Lưu bản nháp** (bài đã xuất bản thì phải bấm thêm **Xuất bản**); ảnh đại diện thì lưu ngay khi tải xong.",
      },
      {
        text: "Khi lưu, khối **Hình ảnh** chưa có ảnh, khối **Nhúng YouTube** chưa có link và khối **Nút CTA** thiếu **Nhãn nút** hoặc **Đường dẫn nút** sẽ không được lưu vào bài.",
      },
      {
        text: "Chữ vàng **Đã lưu.** hoặc **Đã xuất bản.** ở đầu trang nghĩa là thao tác đã xong.",
      },
      {
        text: "Chữ đỏ **Dữ liệu chưa hợp lệ — kiểm tra các trường bắt buộc.**: thường do link ở **Đường dẫn nút** hoặc **Dán link YouTube** sai dạng. Link phải bắt đầu bằng https:// hoặc bằng dấu / (trang trong website).",
      },
      {
        text: "Chữ đỏ **Không thực hiện được. Thử lại sau.** khi lưu: có thể **Slug (tự sinh từ tiêu đề)** tiếng Việt trùng với một bài khác (hai bài cùng tiêu đề), hoặc mạng chập chờn. Sửa slug cho khác đi rồi lưu lại.",
      },
      {
        text: "Trước khi bấm **Xuất bản**, kiểm tra slug không trùng bài khác. Nếu hiện chữ đỏ **Đường dẫn đã được dùng ở bài khác.** thì bản nháp đó bị khóa, không lưu sửa được nữa; báo bộ phận kỹ thuật.",
      },
      {
        text: "Chữ đỏ **Không có bản nháp để xuất bản.**: bài không có gì mới để đưa lên; sửa rồi bấm **Lưu bản nháp** trước.",
      },
      {
        text: "Chữ đỏ **Tải ảnh thất bại — kiểm tra định dạng (JPG/PNG/WebP).**: file không đúng định dạng hoặc quá lớn.",
      },
      {
        text: "Với bài đã xuất bản: sửa xong chỉ bấm **Lưu bản nháp** một lần rồi bấm **Xuất bản**. Nếu bấm lưu lần nữa mà hiện chữ đỏ **Không thực hiện được. Thử lại sau.**, bản lưu lần đầu vẫn còn: bấm **Xuất bản** trước rồi mới sửa tiếp.",
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* Bộ sưu tập                                                          */
  /* ------------------------------------------------------------------ */
  {
    path: "/collections",
    title: "Bộ sưu tập",
    summary:
      "Nơi tạo bộ sưu tập, tải catalogue PDF và xuất bản. Trên website, catalogue hiện dạng sách lật trang; khách chỉ thấy bộ sưu tập đã xuất bản.",
    layout: [
      {
        text: "Đầu trang có tiêu đề **Quản lý bộ sưu tập**. Nếu kho lưu file chưa được cài đặt, một khung vàng báo chưa tải PDF được.",
      },
      {
        text: "Khung **Tạo bộ sưu tập mới**: ô **Tên bộ sưu tập**, ô **Năm**, ô **Mô tả ngắn (không bắt buộc)** và nút **Tạo bản nháp**.",
      },
      {
        text: "Bên dưới là từng thẻ bộ sưu tập: ảnh bìa (trang 1 của PDF), tên, năm, nhãn trạng thái, số trang (hoặc **Chưa có catalogue**) và đường dẫn ngắn.",
      },
      {
        text: "Mỗi thẻ có nút **Tải PDF** (hoặc **Thay PDF**), nút **Xuất bản** (thành **Đã xuất bản** khi đã lên web), link **Xem trên website** (chỉ khi đã xuất bản) và nút **Xóa**.",
      },
      {
        text: "Trang **Công cụ xem thử** (tiêu đề **Thử flipbook với file PDF của bạn**) không có trong menu; mở bằng cách gõ thêm “/preview” vào cuối địa chỉ trang Bộ sưu tập.",
      },
    ],
    capabilities: [
      { text: "Tạo bộ sưu tập mới dưới dạng bản nháp." },
      {
        text: "Tải catalogue PDF cho bộ sưu tập, hoặc thay bằng file PDF khác; nút hiện phần trăm khi đang tải.",
      },
      {
        text: "Bấm **Xuất bản** để đưa bộ sưu tập lên website ngay, không cần bước duyệt riêng.",
      },
      {
        text: "Bấm **Xem trên website** để mở catalogue trên website ở tab mới.",
      },
      { text: "Xóa bộ sưu tập, có bước bấm xác nhận lần hai." },
      {
        text: "Xem thử một file PDF dưới dạng sách lật trang ở **Công cụ xem thử** trước khi tải lên thật; công cụ này không lưu gì.",
      },
      {
        text: "Bộ sưu tập vừa tạo xuất hiện ngay trong ô **Thuộc bộ sưu tập** của trang soạn sản phẩm, kể cả khi còn là bản nháp.",
      },
    ],
    limits: [
      {
        text: "Không có chỗ sửa tên, năm hay mô tả sau khi đã tạo bộ sưu tập.",
      },
      {
        text: "Chỉ tạo được tên và mô tả tiếng Việt, và chỉ gắn một catalogue PDF (bản tiếng Việt) cho mỗi bộ sưu tập.",
      },
      {
        text: "Chỉ nhận file PDF và có giới hạn dung lượng (rê chuột lên nút **Tải PDF** để xem **Tối đa** bao nhiêu MB).",
      },
      {
        text: "Không có nút gỡ xuất bản; bộ sưu tập đã xuất bản chỉ có thể thay PDF hoặc xóa.",
      },
      {
        text: "Xóa bộ sưu tập là gỡ hẳn khỏi website và xóa luôn file PDF đã tải; không có nút khôi phục.",
      },
    ],
    flows: [
      {
        title: "Tạo và xuất bản bộ sưu tập",
        when: "Khi có bộ sưu tập mới cần giới thiệu trên website.",
        steps: [
          "Nhập **Tên bộ sưu tập**, **Năm** và **Mô tả ngắn (không bắt buộc)** trong khung **Tạo bộ sưu tập mới**.",
          "Kiểm tra kỹ tên, năm và mô tả, vì tạo xong không sửa được.",
          "Bấm **Tạo bản nháp**.",
          "Tìm thẻ bộ sưu tập vừa tạo ở danh sách bên dưới (nhãn **Bản nháp**).",
          "Bấm **Tải PDF** và chọn file catalogue.",
          "Chờ nút chạy hết **Đang tải lên…** và thẻ hiện số trang cùng ảnh bìa.",
          "Bấm **Xuất bản**.",
          "Bấm **Xem trên website** để kiểm tra catalogue.",
        ],
        result:
          "Nhãn đổi thành **Đã xuất bản**, nút **Xuất bản** mờ đi với chữ **Đã xuất bản**; khách xem được bộ sưu tập trên website.",
      },
      {
        title: "Thay catalogue PDF",
        when: "Khi catalogue có bản mới.",
        steps: [
          "Bấm **Thay PDF** ở thẻ bộ sưu tập.",
          "Chọn file PDF mới.",
          "Chờ hết **Đang tải lên…** và kiểm tra số trang, ảnh bìa đã đổi.",
          "Bấm **Xem trên website** để kiểm tra (nếu đã xuất bản).",
        ],
        result:
          "File mới thay file cũ ngay, không cần bấm **Xuất bản** lại; bộ sưu tập đã xuất bản thì website đổi catalogue ngay.",
      },
      {
        title: "Xem thử PDF dạng sách lật trang",
        when: "Trước khi tải catalogue thật, để xem file hiển thị thế nào.",
        steps: [
          "Gõ thêm “/preview” vào cuối địa chỉ trang Bộ sưu tập rồi bấm Enter.",
          "Bấm **Chọn file PDF** và chọn file trên máy (tối đa 10 MB).",
          "Bấm các nút mũi tên để lật trang; dòng chữ “Trang … trên …” cho biết đang ở trang nào.",
          "Bấm nút toàn màn hình nếu muốn xem to hơn.",
          "Bấm **Chọn file khác** để thử file khác.",
        ],
        result:
          "Không có gì được tải lên hay lưu lại. Muốn đưa file lên website, quay về trang Bộ sưu tập và bấm **Tải PDF**.",
      },
      {
        title: "Xóa bộ sưu tập",
        steps: [
          "Bấm **Xóa** ở thẻ bộ sưu tập.",
          "Nút đổi thành **Xóa hẳn? Bấm lần nữa**; bấm thêm lần nữa để xóa.",
          "Muốn thôi, bấm ra chỗ khác để nút trở lại như cũ.",
        ],
        result:
          "Bộ sưu tập biến mất khỏi danh sách và khỏi website, file PDF bị xóa.",
      },
    ],
    terms: [
      {
        term: "Bản nháp",
        meaning: "Bộ sưu tập chưa lên website.",
      },
      {
        term: "Đã xuất bản",
        meaning: "Bộ sưu tập đang hiện trên website.",
      },
      {
        term: "Chờ duyệt",
        meaning:
          "Lần bấm **Xuất bản** trước bị dừng giữa chừng. Bấm **Xuất bản** lại.",
      },
      {
        term: "Lưu trữ",
        meaning:
          "Trạng thái có thể hiện trên thẻ; màn hình này không có nút đặt trạng thái đó.",
      },
      {
        term: "PDF",
        meaning:
          "Định dạng file tài liệu. Catalogue phải là file PDF; website dựng mỗi trang PDF thành một trang sách lật.",
      },
      {
        term: "catalogue",
        meaning: "Cuốn giới thiệu sản phẩm của bộ sưu tập.",
      },
      {
        term: "flipbook",
        meaning: "Cách hiển thị PDF như cuốn sách lật từng trang trên website.",
      },
      {
        term: "Đường dẫn ngắn (/…)",
        meaning:
          "Phần chữ không dấu tự sinh từ tên bộ sưu tập, dùng làm địa chỉ trang trên website.",
      },
      {
        term: "MB",
        meaning: "Đơn vị dung lượng file.",
      },
      {
        term: "Cloudinary",
        meaning:
          "Tên kho lưu file ảnh và PDF của website. Chữ này chỉ hiện khi kho chưa được cài đặt.",
      },
    ],
    tips: [
      {
        text: "Hai bộ sưu tập không được trùng tên: tên được đổi thành đường dẫn không dấu, trùng thì hiện chữ đỏ **Không thực hiện được. Thử lại sau.** Hãy đặt tên khác.",
      },
      {
        text: "Tên chỉ gồm ký hiệu, không có chữ hay số thì hiện chữ đỏ **Dữ liệu chưa hợp lệ — kiểm tra lại các trường.**",
      },
      {
        text: "Chữ đỏ **Không xin được chữ ký tải lên.**: phiên đăng nhập có vấn đề hoặc kho lưu file chưa sẵn sàng; tải lại trang và thử lại.",
      },
      {
        text: "Chữ đỏ **Kho lưu trữ từ chối file. Kiểm tra kích thước và định dạng PDF.**: file không phải PDF hoặc lớn hơn giới hạn (khi quá lớn, cuối dòng có ghi **Tối đa** bao nhiêu MB).",
      },
      {
        text: "Chữ đỏ **Đã tải lên nhưng chưa lưu được bản ghi.**: bấm lại nút tải PDF và chọn lại file.",
      },
      {
        text: "Khung vàng **Chưa cấu hình Cloudinary …**: kho lưu file chưa được cài đặt, nút **Tải PDF** bị mờ; báo bộ phận kỹ thuật.",
      },
      {
        text: "Ở **Công cụ xem thử**: **File vượt quá giới hạn 10 MB.**, **File này không phải PDF hợp lệ.**, **Không đọc được file. File có thể hỏng hoặc được đặt mật khẩu.** là các lỗi của file bạn chọn.",
      },
      {
        text: "Nên tải PDF trước rồi mới bấm **Xuất bản**, để khách không mở phải bộ sưu tập chưa có catalogue.",
      },
    ],
  },
];
