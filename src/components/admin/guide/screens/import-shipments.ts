import type { ScreenGuide } from "../guide-types";

/**
 * Guide section for Hàng nhập khẩu. Besides the Director, whose guide keeps to
 * the Director's own desk, only the Company Accountant's menu holds this
 * screen, so every entry is written for that position and left untagged.
 */
export const importShipmentScreens: readonly ScreenGuide[] = [
  {
    path: "/import-shipments",
    title: "Hàng nhập khẩu",
    summary:
      "Nơi lưu đủ chứng từ của từng lô hàng nhập khẩu. Tờ khai vẫn khai trên phần mềm hải quan riêng; màn hình này chỉ giữ thông tin lô hàng và các tệp tờ khai, Invoice, Packing List, B/L, C/O, hợp đồng và chứng từ thanh toán để ai cần cũng tìm được.",
    layout: [
      {
        text: "Đầu trang: tiêu đề **Hàng nhập khẩu** và một dòng giới thiệu ngắn.",
      },
      {
        text: "Thẻ **Thêm lô hàng nhập** gồm các ô **Mã lô hàng**, **Số tờ khai**, **Ngày tờ khai**, **Nhà cung cấp nước ngoài**, **Hàng hóa**, **Ghi chú** và nút **Thêm lô hàng**.",
      },
      {
        text: "Ô **Tìm** cùng nút **Tìm**; khi đang tìm có thêm chữ **Xóa tìm kiếm** để về danh sách đầy đủ.",
      },
      {
        text: "Bảng lô hàng gồm các cột **Mã lô hàng**, **Số tờ khai**, **Ngày tờ khai**, **Nhà cung cấp**, **Chứng từ**. Cột **Chứng từ** cho biết lô có bao nhiêu tệp, kèm nhãn đỏ **Thiếu tờ khai** khi chưa tải tờ khai lên. Lô mới thêm nằm trên cùng.",
      },
      {
        text: "Trang một lô hàng (bấm vào **Mã lô hàng**): mã lô, tên nhà cung cấp, nhãn **Thiếu tờ khai** nếu có; thẻ **Thông tin lô hàng** với các ô như lúc thêm và nút **Lưu thông tin**.",
      },
      {
        text: "Thẻ **Chứng từ của lô hàng** có tám ô, mỗi ô một loại: **Tờ khai nhập khẩu**, **Invoice**, **Packing List**, **B/L**, **C/O**, **Hợp đồng / PO**, **Chứng từ thanh toán**, **Chứng từ khác**. Mỗi ô có nhãn **Đã có** hoặc **Chưa có**, nút **Tải lên** và danh sách tệp (tên tệp, loại tệp, dung lượng, ngày tải) với nút **Gỡ**.",
      },
    ],
    capabilities: [
      {
        text: "Thêm một lô hàng nhập; để trống **Mã lô hàng** thì máy tự tạo mã.",
      },
      {
        text: "Sửa mã lô hàng, số tờ khai, ngày tờ khai, nhà cung cấp, hàng hóa và ghi chú của lô.",
      },
      {
        text: "Tải lên nhiều tệp PDF hoặc ảnh (JPG, PNG, WEBP) cho từng loại chứng từ.",
      },
      {
        text: "Mở xem hoặc tải về một tệp bằng cách bấm vào tên tệp.",
      },
      {
        text: "Gỡ một tệp tải nhầm.",
      },
      {
        text: "Tìm lô hàng theo mã lô, số tờ khai, tên nhà cung cấp hoặc hàng hóa.",
      },
    ],
    limits: [
      {
        text: "Không khai tờ khai hải quan ở đây; tờ khai vẫn khai trên phần mềm hải quan, rồi tải bản tờ khai lên lô hàng.",
      },
      {
        text: "Không xóa được lô hàng. Lô ghi sai thì sửa lại thông tin; lô hàng không có trạng thái và luôn được giữ.",
      },
      {
        text: "Lô hàng không liên kết với kho, công nợ hay sổ thu chi: tải chứng từ thanh toán lên không ghi khoản chi nào, nhập hàng về không cộng tồn kho.",
      },
      {
        text: "Không tải được tệp Word, Excel hay tệp nén; chỉ nhận PDF và ảnh, mỗi tệp không vượt quá dung lượng cho phép.",
      },
      {
        text: "Thêm, sửa, tải lên hay gỡ tệp đều có hiệu lực ngay, không cần Giám đốc duyệt và không gửi thông báo cho ai.",
      },
    ],
    flows: [
      {
        title: "Lưu chứng từ của một lô hàng nhập mới",
        when: "Khi có lô hàng nhập khẩu, thường sau khi đã khai tờ khai trên phần mềm hải quan.",
        steps: [
          "Mở **Hàng nhập khẩu**.",
          "Trong thẻ **Thêm lô hàng nhập**, để trống **Mã lô hàng** (hoặc gõ mã riêng của bạn).",
          "Nhập **Số tờ khai** và **Ngày tờ khai** nếu đã có.",
          "Nhập **Nhà cung cấp nước ngoài** và **Hàng hóa** (bắt buộc); ghi **Ghi chú** nếu cần.",
          "Bấm **Thêm lô hàng**.",
          "Ở trang lô hàng vừa mở, trong thẻ **Chứng từ của lô hàng**, bấm **Tải lên** ở ô **Tờ khai nhập khẩu** và chọn tệp trên máy.",
          "Chờ chữ “Đang tải …%” rồi “Đang lưu…” trên nút biến mất; tệp hiện trong ô.",
          "Làm tương tự cho **Invoice**, **Packing List**, **B/L**, **C/O** và các chứng từ khác đang có.",
        ],
        result:
          "Lô hàng nằm trong danh sách với mã dạng NK-năm tháng ngày-4 ký tự. Khi đã có tờ khai, nhãn **Thiếu tờ khai** biến mất.",
      },
      {
        title: "Bổ sung chứng từ về sau",
        when: "Khi B/L, C/O hay chứng từ thanh toán đến sau ngày thêm lô hàng.",
        steps: [
          "Mở **Hàng nhập khẩu** và gõ mã lô, số tờ khai hoặc tên nhà cung cấp vào ô **Tìm**, bấm **Tìm**.",
          "Bấm vào **Mã lô hàng**.",
          "Bấm **Tải lên** ở đúng ô loại chứng từ và chọn tệp.",
        ],
        result:
          "Ô đó chuyển sang **Đã có** và cột **Chứng từ** ngoài danh sách tăng số tệp.",
      },
      {
        title: "Sửa thông tin lô hàng",
        steps: [
          "Mở trang lô hàng.",
          "Sửa các ô trong thẻ **Thông tin lô hàng**, ví dụ nhập **Số tờ khai** khi mới có.",
          "Bấm **Lưu thông tin**.",
        ],
        result: "Thông báo “Đã lưu thông tin lô hàng.” hiện lên.",
      },
      {
        title: "Gỡ một tệp tải nhầm",
        steps: [
          "Mở trang lô hàng.",
          "Bấm **Gỡ** dưới tệp cần gỡ; câu hỏi “Gỡ tệp này khỏi lô hàng?” hiện ra.",
          "Bấm **Gỡ tệp** để gỡ. Nếu bấm nhầm, bấm lại **Gỡ** để đóng câu hỏi.",
        ],
        result:
          "Thông báo “Đã gỡ tệp.” hiện lên và tệp không còn trong ô. Nếu cần, tải tệp đúng lên lại.",
      },
    ],
    terms: [
      {
        term: "Mã lô hàng",
        meaning:
          "Mã nội bộ của lô hàng nhập, dạng NK-20260914-AB12: NK, ngày thêm lô, rồi 4 ký tự ngẫu nhiên. Có thể gõ mã riêng lúc thêm; mã không được trùng với lô khác.",
      },
      {
        term: "Số tờ khai, Ngày tờ khai",
        meaning:
          "Số và ngày của tờ khai nhập khẩu trên phần mềm hải quan, chép sang để dễ tìm. Không bắt buộc.",
      },
      {
        term: "Thiếu tờ khai",
        meaning:
          "Nhãn đỏ khi ô **Tờ khai nhập khẩu** của lô chưa có tệp nào. Nhập **Số tờ khai** thôi chưa đủ, phải tải bản tờ khai lên.",
      },
      {
        term: "Invoice, Packing List",
        meaning:
          "Hóa đơn thương mại và phiếu đóng gói do nhà cung cấp nước ngoài gửi.",
      },
      {
        term: "B/L",
        meaning: "Vận đơn (Bill of Lading) của hãng tàu.",
      },
      {
        term: "C/O",
        meaning: "Giấy chứng nhận xuất xứ hàng hóa.",
      },
      {
        term: "Hợp đồng / PO",
        meaning: "Hợp đồng mua hàng hoặc đơn đặt hàng với nhà cung cấp.",
      },
      {
        term: "Đã có, Chưa có",
        meaning:
          "Nhãn ở mỗi ô loại chứng từ: ô đã có ít nhất một tệp, hay chưa có tệp nào.",
      },
    ],
    tips: [
      {
        text: "Đặt tên tệp rõ ràng trước khi tải lên (ví dụ “To khai 1056 - 10.09.2026.pdf”): tên tệp là chữ hiện trong danh sách.",
      },
      {
        text: "Một loại chứng từ có nhiều trang chụp riêng thì tải lần lượt từng ảnh vào cùng một ô, hoặc gộp thành một tệp PDF.",
      },
      {
        text: "Chữ đỏ “Tệp vượt quá dung lượng cho phép.” cạnh nút **Tải lên**: nén nhỏ tệp hoặc chia thành nhiều tệp rồi tải lại.",
      },
      {
        text: "Chữ đỏ “Tải lên không thành công. Thử lại.”: kiểm tra mạng, tải lại trang rồi thử lại.",
      },
      {
        text: "Lỗi “Mã lô hàng này đã có.”: đổi mã khác, hoặc để trống để máy tự tạo mã.",
      },
      {
        text: "Lỗi “Lô hàng đã thay đổi trong lúc bạn thao tác…”: người khác vừa sửa hoặc tải tệp lên cùng lô. Kiểm tra lại trang rồi làm lại.",
      },
    ],
  },
];
