import type { ScreenGuide } from "../guide-types";

export const shopSettingsScreens: readonly ScreenGuide[] = [
  {
    path: "/shop",
    title: "Cửa hàng",
    summary:
      "Nơi bạn tạo và chăm sóc các mặt hàng bán lẻ trên website: tên, mô tả, giá VND và USD, số lượng tồn, ảnh, và việc đưa lên bán hay ẩn đi. Khách xem mặt hàng đang bán và tự gửi đơn đặt mua ngay trên website.",
    layout: [
      {
        text: "Đầu trang có tiêu đề **Mặt hàng đang bán**, một đoạn giải thích ngắn và nút **Mặt hàng mới** ở bên phải.",
      },
      {
        text: "Bên dưới là danh sách mặt hàng, mỗi dòng một mặt hàng: tên tiếng Việt (chưa có tên thì hiện slug), slug chữ nhỏ bên dưới, giá VND · giá USD, **Tồn**: số lượng còn lại, trạng thái (**Đang bán** chữ vàng đậm, **Nháp** hoặc **Đã ẩn** chữ xám), rồi hai nút **Biên tập** và **Xóa**.",
      },
      {
        text: "Danh sách xếp theo **Thứ tự hiển thị** (số nhỏ lên trước); cùng số thì mặt hàng vừa sửa gần nhất lên trước. Chưa có mặt hàng nào thì trang hiện “Chưa có mặt hàng nào.”",
      },
      {
        text: "Bấm **Mặt hàng mới** hoặc **Biên tập** để mở trang biên tập. Dòng chữ nhỏ trên cùng ghi **Mặt hàng mới** hoặc **Biên tập mặt hàng**, tiếp theo là tên tiếng Việt cỡ lớn (chưa nhập tên thì hiện **Mặt hàng mới**) và nhãn trạng thái (nhãn chỉ hiện sau khi mặt hàng đã được lưu).",
      },
      {
        text: "Khung **Bán hàng**: ô **Slug (tự sinh từ tên)**, **Giá VND (trang tiếng Việt)**, **Giá USD (các ngôn ngữ khác)**, **Số lượng tồn** (kèm lời nhắc cách tồn kho tự trừ và cộng lại) và **Thứ tự hiển thị (nhỏ lên trước)**.",
      },
      {
        text: "Khung **Ảnh**: nút **Thêm ảnh**, lời nhắc “Lưu trước rồi mới tải ảnh. Ảnh đầu tiên là ảnh chính.”, các ảnh thu nhỏ (ảnh chính có số **1** ở góc) và chữ **Gỡ** dưới mỗi ảnh.",
      },
      {
        text: "Khung **Nội dung**: hai nút chọn ngôn ngữ **VI** và **EN**, cùng ba ô **Tên mặt hàng**, **Mô tả ngắn** và **Mô tả chi tiết — mỗi đoạn cách nhau một dòng trống**. Khi chọn **EN**, dưới hai nút hiện lời nhắc “Bản tiếng Anh không bắt buộc: bỏ trống thì khách quốc tế đọc bản tiếng Việt.”",
      },
      {
        text: "Cuối trang là hàng nút: **Lưu**, **Đưa lên bán** (hoặc **Bán lại** khi mặt hàng đang ẩn), **Ẩn khỏi cửa hàng** (chỉ khi mặt hàng đang bán) và **Xóa mặt hàng** ở góc phải. Với mặt hàng chưa lưu lần nào, **Đưa lên bán** bị mờ và chưa có nút **Xóa mặt hàng**.",
      },
    ],
    capabilities: [
      {
        text: "Tạo mặt hàng mới bằng nút **Mặt hàng mới**. Mặt hàng mới lưu xong luôn ở trạng thái **Nháp**, khách chưa thấy.",
      },
      {
        text: "Nhập giá riêng cho hai loại tiền: **Giá VND (trang tiếng Việt)** chỉ nhận số nguyên (ví dụ 1500000), **Giá USD (các ngôn ngữ khác)** nhận số có tối đa hai chữ số thập phân (ví dụ 59.00). Khách xem website tiếng Việt thấy giá VND; khách xem tiếng Anh, Pháp, Đức, Nhật, Trung thấy giá USD.",
      },
      {
        text: "Nhập tay **Số lượng tồn**. Khi Kế toán công ty xác nhận một đơn, số tồn tự trừ; khi một đơn đã xác nhận bị huỷ, số tồn tự cộng lại.",
      },
      {
        text: "Đặt **Thứ tự hiển thị (nhỏ lên trước)** để quyết định mặt hàng nào đứng trước, cả trong danh sách này lẫn trên trang cửa hàng của website. Có thể nhập số âm (ví dụ -1) để đẩy một mặt hàng lên đầu.",
      },
      {
        text: "Để hệ thống tự tạo slug từ tên tiếng Việt, hoặc tự sửa slug. Chữ bạn gõ vào ô slug tự đổi thành chữ thường không dấu, nối bằng dấu gạch ngang. Nếu xoá trắng ô slug, ô sẽ lại lấy theo tên tiếng Việt.",
      },
      {
        text: "Viết tên, mô tả ngắn và mô tả chi tiết bằng tiếng Việt (thẻ **VI**) và tiếng Anh (thẻ **EN**). Bản tiếng Anh không bắt buộc: ô nào bản tiếng Anh để trống thì khách xem website bằng ngôn ngữ khác tiếng Việt sẽ đọc ô tiếng Việt tương ứng.",
      },
      {
        text: "Tải ảnh JPG, PNG hoặc WebP bằng nút **Thêm ảnh** (tối đa 24 ảnh). Trong lúc tải, nút hiện **Đang tải…** kèm phần trăm. Ảnh được lưu ngay, không cần bấm **Lưu**.",
      },
      {
        text: "Gỡ một ảnh bằng chữ **Gỡ** dưới ảnh. Việc gỡ có hiệu lực ngay.",
      },
      {
        text: "Bấm **Đưa lên bán** để mặt hàng hiện trên website; bấm **Ẩn khỏi cửa hàng** để tạm cất đi; bấm **Bán lại** để đưa mặt hàng đang ẩn lên bán lần nữa.",
      },
      {
        text: "Sửa và bấm **Lưu** bất cứ lúc nào. Nếu mặt hàng đang bán, khách thấy nội dung mới ở lần mở trang tiếp theo.",
      },
      {
        text: "Xóa mặt hàng ngay trên danh sách (nút **Xóa**) hoặc trong trang biên tập (nút **Xóa mặt hàng**). Cả hai đều cần bấm hai lần để chắc chắn.",
      },
    ],
    limits: [
      {
        text: "Bạn không xem được đơn khách đặt. Đơn cửa hàng do Kế toán công ty xử lý ở mục **Đơn cửa hàng**.",
      },
      {
        text: "Không có bản nháp riêng khi sửa mặt hàng đang bán: bấm **Lưu** là khách thấy thay đổi. Muốn sửa lớn mà chưa cho khách thấy, hãy bấm **Ẩn khỏi cửa hàng** trước.",
      },
      {
        text: "Không kéo thả để đổi thứ tự ảnh. Ảnh xếp theo thứ tự tải lên; muốn đổi ảnh chính, hãy gỡ các ảnh đứng trước nó hoặc gỡ hết rồi tải lại theo thứ tự mong muốn.",
      },
      {
        text: "Không tải được ảnh khi mặt hàng chưa được lưu lần nào: nút **Thêm ảnh** bị mờ cho tới khi bạn bấm **Lưu**.",
      },
      {
        text: "Số tồn ở đây chỉ dùng cho cửa hàng trên website. Nó không liên kết với kho sơn hay nguyên vật liệu của nhà máy; bạn tự cập nhật khi có hàng mới.",
      },
      {
        text: "Nội dung chỉ viết được bằng tiếng Việt và tiếng Anh. Trang website tiếng Pháp, Đức, Nhật, Trung dùng bản tiếng Anh (ô nào bản tiếng Anh để trống thì dùng ô tiếng Việt).",
      },
      {
        text: "Xóa mặt hàng không thể hoàn tác trên màn hình. Nếu chỉ muốn ngừng bán một thời gian, hãy dùng **Ẩn khỏi cửa hàng**.",
      },
    ],
    flows: [
      {
        title: "Tạo mặt hàng mới và đưa lên bán",
        when: "Khi có một mặt hàng mới cần bán trên website.",
        steps: [
          "Bấm **Mặt hàng mới** ở đầu trang **Cửa hàng**.",
          "Chọn thẻ **VI** trong khung **Nội dung**.",
          "Nhập **Tên mặt hàng**, **Mô tả ngắn** và **Mô tả chi tiết — mỗi đoạn cách nhau một dòng trống**.",
          "Chọn thẻ **EN** và nhập bản tiếng Anh nếu có (có thể bỏ trống).",
          "Kiểm tra ô **Slug (tự sinh từ tên)** đã tự điền từ tên tiếng Việt; sửa lại nếu muốn địa chỉ ngắn gọn hơn.",
          "Nhập **Giá VND (trang tiếng Việt)** và **Giá USD (các ngôn ngữ khác)**.",
          "Nhập **Số lượng tồn** và **Thứ tự hiển thị (nhỏ lên trước)**.",
          "Bấm **Lưu** và chờ dòng chữ “Đã lưu.” hiện dưới tên mặt hàng.",
          "Bấm **Thêm ảnh**, chọn ảnh chính trước; lặp lại cho các ảnh còn lại.",
          "Kiểm tra ảnh có số **1** đúng là ảnh chính.",
          "Bấm **Đưa lên bán** và chờ dòng chữ “Đã cập nhật trạng thái.”.",
        ],
        result:
          "Nhãn trạng thái đổi thành **Đang bán**. Mặt hàng hiện trong cửa hàng trên website với nhãn **Còn hàng** (hoặc **Hết hàng** nếu tồn bằng 0) và khách có thể gửi đơn đặt mua. Đơn khách gửi hiện ở mục **Đơn cửa hàng** để Kế toán công ty xử lý.",
      },
      {
        title: "Thêm, gỡ ảnh và đổi ảnh chính",
        when: "Khi có ảnh mới đẹp hơn hoặc ảnh cũ không còn đúng.",
        steps: [
          "Bấm **Biên tập** ở dòng mặt hàng trên danh sách.",
          "Bấm **Thêm ảnh** trong khung **Ảnh** và chọn tệp JPG, PNG hoặc WebP.",
          "Chờ nút hết hiện **Đang tải…** và ảnh thu nhỏ xuất hiện.",
          "Bấm **Gỡ** dưới ảnh không còn dùng.",
          "Gỡ các ảnh đứng trước ảnh bạn muốn làm ảnh chính, để ảnh đó lên vị trí số **1**.",
          "Tải lại các ảnh vừa gỡ bằng **Thêm ảnh** nếu vẫn muốn giữ chúng làm ảnh phụ.",
        ],
        result:
          "Ảnh được lưu ngay khi tải lên hoặc gỡ, không cần bấm **Lưu**. Ảnh số **1** là ảnh đại diện của mặt hàng trên website.",
      },
      {
        title: "Sửa giá, mô tả hoặc số tồn",
        when: "Khi giá thay đổi, có thêm hàng về, hoặc cần sửa lời mô tả.",
        steps: [
          "Bấm **Biên tập** ở dòng mặt hàng.",
          "Sửa **Giá VND (trang tiếng Việt)**, **Giá USD (các ngôn ngữ khác)** hoặc **Số lượng tồn**.",
          "Chọn thẻ **VI** hoặc **EN** nếu cần sửa lời mô tả.",
          "Bấm **Lưu**.",
          "Kiểm tra dòng chữ “Đã lưu.” hiện lên.",
        ],
        result:
          "Nếu mặt hàng đang bán, khách thấy giá và nội dung mới ngay ở lần mở trang tiếp theo. Các đơn khách đã gửi trước đó vẫn giữ nguyên giá lúc đặt.",
      },
      {
        title: "Tạm ẩn mặt hàng và bán lại",
        when: "Khi tạm ngừng bán, hoặc cần sửa nhiều mà chưa muốn khách thấy.",
        steps: [
          "Bấm **Biên tập** ở dòng mặt hàng đang bán.",
          "Bấm **Ẩn khỏi cửa hàng**.",
          "Kiểm tra nhãn trạng thái đổi thành **Đã ẩn**.",
          "Sửa nội dung và bấm **Lưu** nếu cần.",
          "Bấm **Bán lại** khi muốn đưa mặt hàng trở lại website.",
        ],
        result:
          "Khi **Đã ẩn**, mặt hàng biến khỏi website và khách không đặt mua được nữa. Sau **Bán lại**, mặt hàng về trạng thái **Đang bán**.",
      },
      {
        title: "Xóa mặt hàng",
        when: "Khi mặt hàng không bao giờ bán nữa hoặc được tạo nhầm.",
        steps: [
          "Bấm **Xóa** ở dòng mặt hàng trên danh sách.",
          "Kiểm tra nút đã đổi thành **Chắc chắn?**.",
          "Bấm **Chắc chắn?** để xóa hẳn (bấm ra chỗ khác nếu đổi ý).",
          "Kiểm tra mặt hàng đã biến khỏi danh sách.",
        ],
        result:
          "Mặt hàng biến khỏi danh sách và khỏi website. Các đơn khách đã đặt trước đó vẫn còn nguyên tên mặt hàng. Slug của mặt hàng đã xóa được phép dùng lại cho mặt hàng khác. Trong trang biên tập, cách làm tương tự với nút **Xóa mặt hàng** → **Xóa hẳn? Bấm lần nữa**; xóa xong bạn được đưa về danh sách.",
      },
    ],
    terms: [
      {
        term: "Slug",
        meaning:
          "Phần cuối địa chỉ trang của mặt hàng trên website, viết chữ thường không dấu, nối bằng dấu gạch ngang (ví dụ binh-son-mai-do). Mỗi mặt hàng phải có slug riêng. Đổi slug thì địa chỉ trang mặt hàng cũng đổi.",
      },
      {
        term: "Nháp",
        meaning:
          "Mặt hàng đã lưu nhưng chưa từng đưa lên bán. Khách không thấy.",
      },
      {
        term: "Đang bán",
        meaning:
          "Mặt hàng đang hiện trên website và khách đặt mua được (nếu còn tồn).",
      },
      {
        term: "Đã ẩn",
        meaning:
          "Mặt hàng đã từng bán nhưng đang được cất khỏi website. Bấm **Bán lại** để hiện lại.",
      },
      {
        term: "Tồn / Số lượng tồn",
        meaning:
          "Số lượng còn bán được. Khách không đặt được nhiều hơn số này. Tồn bằng 0 thì website hiện **Hết hàng** và ẩn phần đặt mua.",
      },
      {
        term: "VND / USD",
        meaning:
          "VND là đồng Việt Nam, hiện cho khách xem website tiếng Việt. USD là đô la Mỹ, hiện cho khách xem mọi ngôn ngữ khác.",
      },
      {
        term: "VI / EN",
        meaning:
          "Hai thẻ chọn ngôn ngữ đang viết trong khung **Nội dung**: VI là tiếng Việt (bắt buộc có tên), EN là tiếng Anh (không bắt buộc).",
      },
      {
        term: "Thứ tự hiển thị",
        meaning:
          "Số quyết định vị trí mặt hàng trong danh sách và trên trang cửa hàng của website: số nhỏ đứng trước; cùng số thì mặt hàng vừa thay đổi gần nhất đứng trước. Mặc định là 0.",
      },
      {
        term: "Ảnh số 1",
        meaning:
          "Ảnh đầu tiên trong khung **Ảnh**, dùng làm ảnh đại diện của mặt hàng trên website.",
      },
      {
        term: "JPG, PNG, WebP",
        meaning:
          "Các loại tệp ảnh được nhận. Ảnh chụp điện thoại thường là JPG. Loại khác sẽ bị từ chối.",
      },
    ],
    tips: [
      {
        text: "Nút **Lưu** bị mờ khi còn thiếu **Tên mặt hàng** tiếng Việt, **Giá VND (trang tiếng Việt)** hoặc **Giá USD (các ngôn ngữ khác)**. Điền đủ ba ô này là bấm được.",
      },
      {
        text: "Bấm **Đưa lên bán** không lưu những gì bạn vừa gõ. Luôn bấm **Lưu** trước, rồi mới bấm **Đưa lên bán**.",
      },
      {
        text: "Dòng chữ vàng dưới tên mặt hàng là thông báo thành công: “Đã lưu.” sau khi lưu, “Đã cập nhật trạng thái.” sau khi đưa lên bán, ẩn hoặc bán lại.",
      },
      {
        text: "“Mặt hàng vừa được người khác sửa. Tải lại trang.” (chữ đỏ): mặt hàng đã thay đổi trong lúc bạn đang mở, ví dụ Kế toán công ty vừa xác nhận hoặc huỷ một đơn làm số tồn thay đổi. Lần lưu này không được ghi. Hãy chép lại những chữ vừa gõ (tải lại trang sẽ mất chúng), tải lại trang, kiểm tra số tồn mới rồi sửa và bấm **Lưu** lần nữa.",
      },
      {
        text: "“Slug đã được dùng ở mặt hàng khác.” (chữ đỏ): đổi slug, ví dụ thêm màu hoặc kích thước vào cuối.",
      },
      {
        text: "“Dữ liệu chưa hợp lệ — kiểm tra tên, slug, giá và tồn kho.” (chữ đỏ): thường do giá USD viết sai (hơn hai chữ số sau dấu chấm, hoặc có hai dấu chấm), tên tiếng Việt chỉ gồm ký hiệu nên không tạo được slug, **Thứ tự hiển thị (nhỏ lên trước)** chỉ có dấu trừ, hoặc mặt hàng đã có đủ 24 ảnh mà vẫn tải thêm.",
      },
      {
        text: "“Tải ảnh thất bại — kiểm tra định dạng (JPG/PNG/WebP).” (chữ đỏ): tệp không phải JPG, PNG, WebP, tệp quá dung lượng cho phép, hoặc mạng hay dịch vụ lưu ảnh đang trục trặc. Hãy lưu lại ảnh ở dạng JPG, giảm dung lượng rồi thử lại; vẫn lỗi thì báo Giám đốc.",
      },
      {
        text: "Các thông báo đỏ khác: “Cần có tên tiếng Việt trước khi đưa lên bán.”, “Bạn không có quyền thực hiện thao tác này.”, “Không tìm thấy mặt hàng.” (mặt hàng có thể vừa bị xóa) và “Không thực hiện được. Thử lại sau.” (lỗi tạm thời, chờ một lát rồi bấm lại).",
      },
      {
        text: "Trong lúc hệ thống đang làm, nút đổi chữ thành **Đang lưu…**, **Đang cập nhật…** hoặc **Đang xóa…** và các nút khác bị mờ. Chờ chữ trở lại bình thường rồi mới bấm tiếp.",
      },
      {
        text: "Nút xóa cần bấm hai lần. Sau lần bấm đầu, nếu bạn bấm ra chỗ khác thì nút trở về như cũ và không có gì bị xóa. Nút **Xóa** trên danh sách không hiện thông báo lỗi: nếu bấm lần hai mà mặt hàng vẫn còn trên danh sách, hãy tải lại trang để kiểm tra.",
      },
      {
        text: "Trong **Mô tả chi tiết**, để một dòng trống giữa hai đoạn thì website mới tách thành hai đoạn; xuống dòng một lần sẽ bị nối liền.",
      },
      {
        text: "Giá trên website chưa gồm phí vận chuyển; website đã ghi rõ điều này cho khách, bạn không cần viết thêm vào mô tả.",
      },
    ],
  },
  {
    path: "/shop/orders",
    title: "Đơn cửa hàng",
    summary:
      "Nơi nhận và xử lý các đơn khách tự đặt mua trên cửa hàng của website. Bạn trao đổi phí vận chuyển với khách, rồi xác nhận, hoàn thành hoặc huỷ đơn; tồn kho của mặt hàng tự trừ khi bạn xác nhận.",
    layout: [
      {
        text: "Đầu trang có tiêu đề **Đơn đặt mua** và lời nhắc: xác nhận sau khi đã trao đổi phí vận chuyển với khách; tồn kho trừ khi xác nhận.",
      },
      {
        text: "Hàng nút lọc theo trạng thái: **Tất cả**, **Mới**, **Đã xác nhận**, **Hoàn thành**, **Đã huỷ**. Nút đang chọn có nền đậm.",
      },
      {
        text: "Danh sách đơn, mới nhất ở trên. Mỗi dòng có: tên khách kèm mã đơn chữ nhỏ, tên mặt hàng × số lượng, số tiền tạm tính, trạng thái (**Mới** chữ đỏ đậm, **Đã xác nhận** chữ vàng đậm), dòng nhỏ **· chưa gửi mail** nếu có, ngày giờ khách đặt và nút **Mở**. Chưa có đơn thì trang hiện “Chưa có đơn nào.”",
      },
      {
        text: "Bấm **Mở** để vào trang chi tiết đơn. Trên cùng có liên kết **← Tất cả đơn**, mã đơn cỡ lớn, nhãn trạng thái và (nếu có) dòng “Đang giữ tồn kho cho đơn này.”",
      },
      {
        text: "Khung thông tin đơn: **Mặt hàng**, **Số lượng**, **Đơn giá**, **Tạm tính (chưa gồm phí vận chuyển)**, **Ngôn ngữ khách đặt**.",
      },
      {
        text: "Khung **Khách hàng**: **Họ tên**, **Điện thoại**, **Email**, **Địa chỉ** và **Ghi chú** (chỉ hiện khi khách có ghi).",
      },
      {
        text: "Khung **Thông báo email**: **Gửi cho admin** và **Gửi cho khách** (mỗi dòng ghi **Đã gửi** kèm giờ, hoặc **Chưa gửi**), và **Lỗi gần nhất** nếu việc gửi gặp lỗi. Khung **Lịch sử** liệt kê từng lần đổi trạng thái kèm giờ và lý do.",
      },
      {
        text: "Cuối trang, khi đơn đang **Mới** hoặc **Đã xác nhận**, có khung thao tác: ô **Lý do (tuỳ chọn)** và các nút **Xác nhận đơn**, **Hoàn thành**, **Huỷ đơn** tuỳ trạng thái. Đơn **Hoàn thành** hoặc **Đã huỷ** không còn khung này.",
      },
    ],
    capabilities: [
      {
        text: "Xem mọi đơn khách đặt trên website, lọc theo trạng thái bằng các nút **Tất cả**, **Mới**, **Đã xác nhận**, **Hoàn thành**, **Đã huỷ**.",
      },
      {
        text: "Mở từng đơn để xem mặt hàng, số lượng, đơn giá, tạm tính, ngôn ngữ khách dùng khi đặt, cùng họ tên, điện thoại, email, địa chỉ và ghi chú của khách.",
      },
      {
        text: "Kiểm tra email báo đơn đã gửi được cho công ty và cho khách chưa, trong khung **Thông báo email**.",
      },
      {
        text: "Bấm **Xác nhận đơn** với đơn **Mới**: số lượng của đơn được trừ vào tồn kho của mặt hàng.",
      },
      {
        text: "Bấm **Hoàn thành** với đơn **Đã xác nhận** sau khi đã giao hàng xong.",
      },
      {
        text: "Bấm **Huỷ đơn** với đơn **Mới** hoặc **Đã xác nhận**. Nếu đơn đã xác nhận, số lượng được cộng trả lại vào tồn kho.",
      },
      {
        text: "Ghi lý do vào ô **Lý do (tuỳ chọn)** trước khi bấm nút. Lý do được lưu vào **Lịch sử** của đơn.",
      },
    ],
    limits: [
      {
        text: "Không sửa được số lượng, giá, mặt hàng hay thông tin khách trên đơn. Nếu khách muốn đổi, hãy huỷ đơn và nhờ khách đặt lại trên website.",
      },
      {
        text: "Không có ô ghi phí vận chuyển. Bạn trao đổi phí với khách qua điện thoại hoặc email, và có thể ghi lại vào ô **Lý do (tuỳ chọn)** khi xác nhận.",
      },
      {
        text: "Đổi trạng thái đơn không tự gửi email cho khách. Bạn tự báo cho khách qua điện thoại hoặc email.",
      },
      {
        text: "Đơn **Hoàn thành** hoặc **Đã huỷ** là trạng thái cuối, không mở lại được.",
      },
      {
        text: "Đơn cửa hàng không tự tạo hóa đơn hay ghi nhận tiền thu ở các mục tài chính, và không nằm trong **Sổ đơn hàng**.",
      },
      {
        text: "Bạn không sửa được mặt hàng, giá hay số tồn của cửa hàng. Việc đó do Biên tập nội dung làm ở mục **Cửa hàng**.",
      },
      {
        text: "Khung **Lịch sử** không hiện tên người đã bấm nút; nếu cần, hãy ghi tên mình vào ô **Lý do (tuỳ chọn)**.",
      },
    ],
    flows: [
      {
        title: "Đơn cửa hàng được tạo ra như thế nào",
        when: "Khách tự làm trên website; bạn không cần thao tác gì. Đọc để hiểu đơn đến từ đâu.",
        steps: [
          "Mở cửa hàng trên website và bấm **Xem mặt hàng** ở một mặt hàng **Còn hàng**.",
          "Kéo xuống phần **Đặt mua**.",
          "Nhập **Số lượng** (không vượt quá số tồn), **Họ và tên**, **Số điện thoại**, **Email**, **Địa chỉ nhận hàng** và **Ghi chú (tuỳ chọn)**.",
          "Bấm **Gửi đơn đặt mua**.",
          "Nhận thông báo “Đã nhận đơn của bạn” kèm **Mã đơn** trên màn hình.",
        ],
        result:
          "Đơn xuất hiện ở đầu danh sách **Đơn cửa hàng** với trạng thái **Mới**. Hệ thống thử gửi một email báo đơn mới tới hộp thư công ty (có liên kết **Mở đơn trong cổng quản trị**) và một email xác nhận tới khách; kết quả ghi ở khung **Thông báo email**. Lúc này tồn kho chưa bị trừ. Mỗi đơn chỉ gồm một mặt hàng; giá chưa gồm phí vận chuyển.",
      },
      {
        title: "Xác nhận đơn mới",
        when: "Khi có đơn **Mới** (email báo đơn mới, hoặc bạn thấy đơn chữ đỏ trên danh sách).",
        steps: [
          "Bấm nút lọc **Mới**.",
          "Bấm **Mở** ở đơn cần xử lý.",
          "Kiểm tra **Mặt hàng**, **Số lượng** và **Tạm tính (chưa gồm phí vận chuyển)**.",
          "Gọi điện hoặc gửi email cho khách theo **Điện thoại** / **Email** để xác nhận đơn và báo phí vận chuyển.",
          "Nhập phí vận chuyển đã chốt hoặc ghi chú ngắn vào ô **Lý do (tuỳ chọn)**.",
          "Bấm **Xác nhận đơn**.",
          "Kiểm tra dòng chữ “Đã cập nhật.” và nhãn trạng thái đổi thành **Đã xác nhận**.",
        ],
        result:
          "Số lượng của đơn được trừ vào tồn kho của mặt hàng, trang đơn hiện “Đang giữ tồn kho cho đơn này.” và **Lịch sử** thêm dòng **Mới** → **Đã xác nhận**. Không có email nào tự gửi cho khách. Tiếp theo là giao hàng cho khách.",
      },
      {
        title: "Hoàn thành đơn sau khi giao hàng",
        when: "Khi khách đã nhận hàng.",
        steps: [
          "Bấm nút lọc **Đã xác nhận**.",
          "Bấm **Mở** ở đơn đã giao.",
          "Nhập ghi chú vào ô **Lý do (tuỳ chọn)** nếu cần (ví dụ ngày giao).",
          "Bấm **Hoàn thành**.",
          "Kiểm tra nhãn trạng thái đổi thành **Hoàn thành**.",
        ],
        result:
          "Đơn kết thúc, khung thao tác biến mất. Tồn kho giữ nguyên như lúc xác nhận.",
      },
      {
        title: "Huỷ đơn",
        when: "Khi khách không mua nữa, không liên lạc được khách, hoặc không đủ hàng.",
        steps: [
          "Bấm **Mở** ở đơn cần huỷ (đơn phải đang **Mới** hoặc **Đã xác nhận**).",
          "Nhập lý do huỷ vào ô **Lý do (tuỳ chọn)**.",
          "Bấm **Huỷ đơn**.",
          "Kiểm tra nút đã đổi thành **Huỷ hẳn? Bấm lần nữa**.",
          "Bấm **Huỷ hẳn? Bấm lần nữa** để huỷ (bấm ra chỗ khác nếu đổi ý).",
          "Kiểm tra nhãn trạng thái đổi thành **Đã huỷ**.",
          "Báo cho khách biết đơn đã huỷ qua điện thoại hoặc email.",
        ],
        result:
          "Đơn chuyển sang **Đã huỷ** và không mở lại được. Nếu đơn đã được xác nhận trước đó, số lượng được cộng trả lại vào tồn kho; nếu đơn còn **Mới**, tồn kho không đổi.",
      },
      {
        title: "Xử lý khi không đủ tồn kho để xác nhận",
        when: "Khi bấm **Xác nhận đơn** mà hiện “Tồn kho không đủ để xác nhận đơn này.”",
        steps: [
          "Hỏi Biên tập nội dung xem mặt hàng còn đang bán và có thêm hàng về không.",
          "Chờ Biên tập nội dung cập nhật **Số lượng tồn** ở mục **Cửa hàng** nếu có hàng.",
          "Tải lại trang đơn.",
          "Bấm **Xác nhận đơn** lần nữa.",
          "Gọi cho khách báo không đủ hàng nếu vẫn báo lỗi.",
          "Huỷ đơn theo các bước huỷ nếu khách không mua nữa.",
          "Nhờ khách đặt lại trên website với số lượng mới nếu khách muốn mua ít hơn.",
        ],
        result:
          "Lỗi này thường xảy ra vì khi khách đặt, tồn kho chưa bị giữ: hai khách có thể cùng đặt những chiếc cuối cùng, và đơn nào được xác nhận trước thì lấy hàng trước. Lỗi cũng hiện khi Biên tập nội dung đã giảm số tồn hoặc đã xóa mặt hàng; mặt hàng đã xóa thì không xác nhận được nữa, chỉ huỷ được.",
      },
      {
        title: "Kiểm tra email báo đơn",
        when: "Khi thấy **· chưa gửi mail** trên danh sách, hoặc khách nói không nhận được email.",
        steps: [
          "Bấm **Mở** ở đơn cần kiểm tra.",
          "Xem dòng **Gửi cho admin** và **Gửi cho khách** trong khung **Thông báo email**.",
          "Đọc dòng **Lỗi gần nhất** nếu có.",
          "Gọi điện cho khách theo **Điện thoại** để xác nhận đơn nếu **Gửi cho khách** ghi **Chưa gửi**.",
          "Chụp màn hình khung **Thông báo email** gửi Giám đốc nếu lỗi lặp lại ở nhiều đơn.",
        ],
        result:
          "Đơn vẫn được lưu đầy đủ dù email không gửi được; bạn xử lý đơn bình thường. Màn hình không có nút gửi lại email.",
      },
    ],
    terms: [
      {
        term: "Mới",
        meaning: "Khách vừa đặt, chưa ai xử lý. Tồn kho chưa bị trừ.",
      },
      {
        term: "Đã xác nhận",
        meaning:
          "Bạn đã chốt đơn với khách. Số lượng của đơn đã được trừ vào tồn kho.",
      },
      {
        term: "Hoàn thành",
        meaning: "Đơn đã giao xong. Đây là trạng thái cuối.",
      },
      {
        term: "Đã huỷ",
        meaning:
          "Đơn không thực hiện. Đây là trạng thái cuối; nếu trước đó đã xác nhận thì tồn kho đã được cộng trả.",
      },
      {
        term: "Mã đơn",
        meaning:
          "Mã dạng SH-năm tháng ngày-4 ký tự (ví dụ SH-20260914-K7QM). Khách thấy mã này trên màn hình sau khi gửi đơn và trong email xác nhận. Ngày trong mã tính theo giờ quốc tế, nên đơn đặt từ 0 giờ đến trước 7 giờ sáng (giờ Việt Nam) mang ngày hôm trước. Dùng mã để tra đơn khi khách gọi.",
      },
      {
        term: "Tạm tính (chưa gồm phí vận chuyển)",
        meaning:
          "Đơn giá × số lượng, tính bằng loại tiền khách thấy lúc đặt: VND nếu khách dùng website tiếng Việt, USD nếu dùng ngôn ngữ khác. Phí vận chuyển chưa có trong số này.",
      },
      {
        term: "Đơn giá",
        meaning:
          "Giá một sản phẩm tại thời điểm khách đặt. Sau này giá trên cửa hàng có đổi thì đơn cũ vẫn giữ giá cũ.",
      },
      {
        term: "Ngôn ngữ khách đặt",
        meaning:
          "Ngôn ngữ website khách dùng khi đặt: vi (tiếng Việt), en (tiếng Anh), fr (tiếng Pháp), de (tiếng Đức), ja (tiếng Nhật), zh-CN (tiếng Trung). Nên liên lạc với khách bằng ngôn ngữ này.",
      },
      {
        term: "VND / USD",
        meaning: "VND là đồng Việt Nam, USD là đô la Mỹ.",
      },
      {
        term: "· chưa gửi mail",
        meaning:
          "Hiện trên danh sách cạnh đơn **Mới** khi email báo đơn tới hộp thư công ty chưa gửi được. Hãy mở đơn để xử lý.",
      },
      {
        term: "Gửi cho admin / Gửi cho khách",
        meaning:
          "**Gửi cho admin** là email báo đơn mới tới hộp thư công ty; **Gửi cho khách** là email xác nhận đã nhận đơn tới khách. **Đã gửi** kèm giờ là đã gửi đi; **Chưa gửi** là chưa gửi được.",
      },
      {
        term: "Lỗi gần nhất",
        meaning:
          "Lý do email không gửi được, do hệ thống gửi thư ghi lại và thường bằng tiếng Anh. Chữ “admin:” ở đầu là lỗi của email gửi công ty, “customer:” là lỗi của email gửi khách.",
      },
      {
        term: "Đang giữ tồn kho cho đơn này.",
        meaning:
          "Số lượng của đơn đang được trừ khỏi tồn kho (đơn đã xác nhận hoặc đã hoàn thành).",
      },
      {
        term: "Khách đặt",
        meaning:
          "Dòng đầu tiên trong **Lịch sử**: lúc khách gửi đơn trên website.",
      },
    ],
    tips: [
      {
        text: "Luôn gọi hoặc email cho khách để chốt phí vận chuyển trước khi bấm **Xác nhận đơn**. Website đã báo khách rằng phí vận chuyển sẽ được trao đổi trước khi giao.",
      },
      {
        text: "Xác nhận đơn sớm: đơn **Mới** chưa giữ hàng, nên nếu để lâu có thể khách khác đặt hết số tồn.",
      },
      {
        text: "“Đã cập nhật.” (chữ vàng) nghĩa là thao tác thành công; trang tự tải lại với trạng thái mới.",
      },
      {
        text: "“Đơn vừa được người khác cập nhật. Tải lại trang.” (chữ đỏ): người khác (ví dụ Giám đốc) vừa xử lý đơn này, hoặc bạn bấm nút thứ hai quá nhanh trước khi trang kịp tải lại. Thao tác không được ghi. Tải lại trang và xem trạng thái mới trước khi làm tiếp.",
      },
      {
        text: "“Tồn kho không đủ để xác nhận đơn này.” (chữ đỏ): số tồn hiện tại ít hơn số lượng khách đặt, hoặc mặt hàng đã bị xóa khỏi cửa hàng. Xem cách xử lý ở phần “Xử lý khi không đủ tồn kho để xác nhận”.",
      },
      {
        text: "Các thông báo đỏ khác: “Trạng thái đơn không cho phép thao tác này.”, “Bạn không có quyền thực hiện thao tác này.”, “Không tìm thấy đơn.” và “Không thực hiện được. Thử lại sau.” (lỗi tạm thời, chờ một lát rồi bấm lại). Gặp các thông báo này, hãy tải lại trang trước khi thử lại.",
      },
      {
        text: "Trong lúc hệ thống đang làm, nút bạn bấm đổi chữ thành **Đang cập nhật…** và các nút khác bị mờ. Chờ xong rồi mới bấm tiếp.",
      },
      {
        text: "Ô **Lý do (tuỳ chọn)** dùng chung cho cả ba nút. Chữ trong ô được lưu vào **Lịch sử** cùng với nút bạn bấm, nên hãy xoá chữ cũ trước khi bấm nút khác.",
      },
      {
        text: "Nếu khách nói không nhận được email xác nhận, hãy xem khung **Thông báo email**. Dòng **Gửi cho khách** ghi **Chưa gửi** thì liên lạc với khách qua điện thoại.",
      },
      {
        text: "Nút **Huỷ đơn** cần bấm hai lần. Bấm ra chỗ khác sau lần đầu thì nút trở về như cũ và đơn không bị huỷ.",
      },
    ],
  },
  {
    path: "/settings",
    title: "Thiết lập",
    summary:
      "Trang chỉ để xem: cho biết các dịch vụ nền của website (đăng nhập, lưu ảnh, gửi email, trợ lý AI, nhắc việc, Zalo) đã được cài đặt và đang chạy hay chưa. Dùng khi một chức năng không hoạt động để biết nguyên nhân có nằm ở phần cài đặt không.",
    layout: [
      {
        text: "Đầu trang có dòng chữ nhỏ **Thiết lập hệ thống**, tiêu đề **Thiết lập** và lời giải thích: trang này chỉ hiển thị, thay đổi do người phụ trách kỹ thuật thực hiện ở phần cài đặt máy chủ.",
      },
      {
        text: "Một bảng ba cột: **Hạng mục**, **Trạng thái**, **Ghi chú**. Mỗi dòng là một dịch vụ.",
      },
      {
        text: "Các dòng trong bảng: **Cơ sở dữ liệu MongoDB**, **Đăng nhập & phiên làm việc**, **Google OAuth**, **Mở toàn quyền khi phát triển**, **Lưu trữ ảnh Cloudinary**, **Email thông báo (Resend)**, **Trợ lý AI**, **Nhắc việc qua email/Zalo**, **Lịch chạy nhắc việc (CRON_SECRET)**, **Zalo Official Account**.",
      },
      {
        text: "Cột **Trạng thái** là một nhãn tròn: nền xanh lá là ổn, nền vàng cam là cần chú ý, nền xám là chưa có hoặc đang tắt.",
      },
      {
        text: "Cột **Ghi chú** giải thích thêm khi cần, ví dụ dòng chữ nhỏ **Thiếu** kèm tên các mục cài đặt còn thiếu, hoặc tình trạng kết nối Zalo.",
      },
      {
        text: "Cuối trang là khung **Cấp quyền cho nhân sự**, nhắc cách người mới được cấp quyền.",
      },
    ],
    capabilities: [
      {
        text: "Xem dịch vụ nào **Đã cấu hình** (xanh lá), **Chưa cấu hình** (xám), hoặc đang có cảnh báo (vàng cam).",
      },
      {
        text: "Xem dòng **Email thông báo (Resend)** để biết dịch vụ gửi email (dùng cho email báo đơn cửa hàng và email nhắc việc) đã được cài đặt hay chưa. Dòng này không cho biết một email cụ thể đã tới người nhận hay chưa.",
      },
      {
        text: "Xem dòng **Lưu trữ ảnh Cloudinary** khi đồng nghiệp không tải được ảnh hay tệp.",
      },
      {
        text: "Xem dòng **Trợ lý AI** để biết trợ lý đang dùng mô hình thật hay bản giả lập (**mock**).",
      },
      {
        text: "Xem dòng **Nhắc việc qua email/Zalo** để biết nhắc việc đang gửi thật, chỉ gửi tới địa chỉ thử nghiệm, hay đang tắt, và theo múi giờ nào.",
      },
      {
        text: "Xem dòng **Zalo Official Account**: đã kết nối lúc nào, mã kết nối còn hiệu lực đến khi nào, đã tự làm mới bao nhiêu lần, và lỗi gần nhất nếu có.",
      },
    ],
    limits: [
      {
        text: "Không thay đổi được gì trên trang này: không có ô nhập hay nút lưu. Mọi thay đổi do người phụ trách kỹ thuật của website thực hiện.",
      },
      {
        text: "Bạn không thấy nút **Kết nối Zalo** / **Kết nối lại Zalo** và không thấy địa chỉ cần đăng ký với Zalo. Chỉ Giám đốc kết nối Zalo. Khi ghi chú của dòng Zalo nhắc “Bấm Kết nối Zalo” hay “Kết nối lại Zalo”, hãy báo Giám đốc.",
      },
      {
        text: "Không cấp quyền hay đổi vai trò cho nhân sự ở đây. Việc đó do Giám đốc làm ở mục **Danh sách nhân sự**.",
      },
    ],
    flows: [
      {
        title: "Kiểm tra khi một chức năng không chạy",
        when: "Khi email không tới, không tải được ảnh, trợ lý AI trả lời lạ, hoặc không ai nhận được nhắc việc.",
        steps: [
          "Bấm **Thiết lập** trên menu.",
          "Tìm dòng của chức năng đang lỗi trong cột **Hạng mục** (ví dụ **Email thông báo (Resend)** cho email).",
          "Xem nhãn ở cột **Trạng thái**.",
          "Đọc cột **Ghi chú** nếu nhãn xám hoặc vàng cam.",
          "Chụp màn hình cả dòng đó.",
          "Gửi ảnh chụp cho Giám đốc hoặc người phụ trách kỹ thuật kèm mô tả lỗi bạn gặp.",
        ],
        result:
          "Người phụ trách kỹ thuật sửa phần cài đặt. Sau khi họ báo xong, tải lại trang **Thiết lập** để kiểm tra nhãn của dòng đó đã chuyển sang màu xanh lá (riêng dòng **Mở toàn quyền khi phát triển** thì phải là **Đang tắt**).",
      },
      {
        title: "Báo Giám đốc khi Zalo cần kết nối lại",
        when: "Khi dòng **Zalo Official Account** có nhãn vàng cam hoặc **Chưa cấu hình**, hoặc nhân viên không nhận được nhắc việc qua Zalo.",
        steps: [
          "Bấm **Thiết lập** trên menu.",
          "Tìm dòng **Zalo Official Account**.",
          "Đọc cột **Ghi chú**: xem có câu “Chưa kết nối Zalo OA”, “Làm mới token thất bại”, “Access token đã hết hạn” hoặc “Refresh token sắp hết hạn” không.",
          "Chụp màn hình dòng này.",
          "Gửi ảnh cho người phụ trách kỹ thuật nếu **Ghi chú** có dòng chữ nhỏ **Thiếu**: đó là thiếu cài đặt, kết nối lại không giúp được.",
          "Gửi ảnh cho Giám đốc trong các trường hợp còn lại, và đề nghị Giám đốc mở trang **Thiết lập** bằng tài khoản của mình để bấm **Kết nối lại Zalo** (hoặc **Kết nối Zalo**).",
        ],
        result:
          "Sau khi Giám đốc kết nối xong, ghi chú hiện “Đã kết nối …” và hệ thống tự làm mới mã kết nối, không cần ai thao tác thêm. Riêng câu “Làm mới token thất bại” nghĩa là hệ thống sẽ tự thử lại ở lần chạy sau; chỉ cần kết nối lại nếu câu này còn hiện nhiều ngày hoặc chuyển thành “Access token đã hết hạn”.",
      },
    ],
    terms: [
      {
        term: "Đã cấu hình / Chưa cấu hình",
        meaning:
          "Dịch vụ đã được cài đặt đủ để chạy / còn thiếu cài đặt nên chưa chạy được.",
      },
      {
        term: "Đang bật / Đang tắt",
        meaning:
          "Chỉ dùng cho dòng **Mở toàn quyền khi phát triển**. Khi vận hành thật, dòng này phải là **Đang tắt**.",
      },
      {
        term: "Nhãn vàng cam",
        meaning:
          "Dịch vụ vẫn có nhưng cần chú ý: trợ lý AI đang dùng bản giả lập, nhắc việc chỉ gửi tới địa chỉ thử nghiệm, chế độ mở toàn quyền đang bật, hoặc kết nối Zalo có vấn đề.",
      },
      {
        term: "Thiếu",
        meaning:
          "Dòng chữ nhỏ trong **Ghi chú** liệt kê tên các mục cài đặt còn thiếu trên máy chủ. Bạn không cần hiểu các tên này, chỉ cần chụp lại gửi người phụ trách kỹ thuật.",
      },
      {
        term: "**MongoDB**",
        meaning:
          "Nơi lưu toàn bộ dữ liệu của hệ thống. Chưa cấu hình thì trang quản trị không chạy.",
      },
      {
        term: "Google OAuth",
        meaning:
          "Cách đăng nhập bằng tài khoản Gmail. Chưa cấu hình thì không ai đăng nhập được.",
      },
      {
        term: "Mở toàn quyền khi phát triển",
        meaning:
          "Chế độ chỉ dùng khi xây dựng website: mọi tài khoản đã đăng nhập xem được mọi khu vực. Nếu thấy **Đang bật**, báo ngay Giám đốc.",
      },
      {
        term: "Cloudinary",
        meaning: "Dịch vụ lưu ảnh và tệp tải lên của website.",
      },
      {
        term: "Resend",
        meaning:
          "Dịch vụ gửi email của hệ thống (email báo đơn cửa hàng, email nhắc việc…).",
      },
      {
        term: "Trợ lý AI và mock",
        meaning:
          "Nhãn **Đã cấu hình** kèm tên nhà cung cấp và tên mô hình là trợ lý đang dùng mô hình thật. Nếu kèm chữ “mock” thì đó là bản giả lập chỉ để thử, câu trả lời không phải của mô hình thật.",
      },
      {
        term: "live / test / off",
        meaning:
          "Chế độ ở dòng **Nhắc việc qua email/Zalo**: live là gửi thật tới từng người; test là mọi nhắc việc chỉ gửi tới địa chỉ thử nghiệm; off là hệ thống ghi nhận nhắc việc nhưng không gửi đi. Phần sau dấu chấm giữa (ví dụ Asia/Ho_Chi_Minh) là múi giờ dùng để tính giờ nhắc.",
      },
      {
        term: "CRON_SECRET",
        meaning:
          "Tên mục cài đặt cho phép nhắc việc tự chạy theo lịch. Chưa có thì nhắc việc chỉ chạy khi có người bấm chạy bằng tay.",
      },
      {
        term: "Zalo Official Account (OA)",
        meaning:
          "Tài khoản Zalo chính thức của công ty, dùng để gửi nhắc việc cho nhân viên qua Zalo.",
      },
      {
        term: "Token, access token, refresh token",
        meaning:
          "Các mã kết nối giữa hệ thống và Zalo. Access token dùng để gửi tin và hết hạn nhanh; refresh token dùng để tự xin access token mới và có hạn khoảng 3 tháng. Hệ thống tự làm mới; chỉ khi ghi chú báo lỗi hoặc sắp hết hạn mới cần Giám đốc kết nối lại.",
      },
    ],
    tips: [
      {
        text: "Trang đọc tình trạng ngay lúc bạn mở. Sau khi người phụ trách kỹ thuật báo đã sửa, hãy tải lại trang để xem tình trạng mới.",
      },
      {
        text: "Nếu khách mua hàng trên website không nhận được email, hãy xem dòng **Email thông báo (Resend)** ở đây trước, rồi xem khung **Thông báo email** trong từng đơn ở mục **Đơn cửa hàng**. Trong lúc chờ sửa, gọi điện cho khách để xác nhận đơn.",
      },
      {
        text: "Dòng **Mở toàn quyền khi phát triển** hiện **Đang bật** (vàng cam) là rủi ro: mọi người đăng nhập đều xem được dữ liệu tài chính. Báo Giám đốc ngay.",
      },
      {
        text: "Người mới đăng nhập bằng Gmail sẽ chờ ở **Danh sách nhân sự** cho tới khi Giám đốc duyệt và chọn vai trò. Nếu đồng nghiệp mới báo đăng nhập xong mà không thấy gì, hãy nhắc Giám đốc duyệt.",
      },
    ],
  },
];
