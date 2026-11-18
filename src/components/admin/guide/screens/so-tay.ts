import type { ScreenGuide } from "@/components/admin/guide/guide-types";

/**
 * Sổ tay (sổ chung quản lý sản xuất). Mọi vai trò có Sổ tay đều mở cùng một
 * màn hình; quyền xem từng tab và quyền ghi nằm trong chính Sổ tay.
 */
export const soTayScreens: readonly ScreenGuide[] = [
  {
    path: "/so-tay",
    title: "Sổ tay",
    summary:
      "Sổ chung để Giám đốc, quản lý xưởng, kế toán và thủ kho cùng theo dõi một luồng dữ liệu: đơn gửi xưởng và tiến độ, chia việc cho cơ sở, hợp đồng và công nợ cơ sở, đề nghị chi, kho vật tư, chi tiêu xưởng, chấm công và bảng lương. Khách hàng không thấy trang này.",
    layout: [
      {
        text: "Mở Sổ tay là **màn hình chào**: lời chào, ngày dương lịch và âm lịch, bảng **Công việc hiện tại của ngày hôm nay cần lưu ý** (việc quá hạn và việc đến hạn trong 3 ngày) và **lịch sản xuất 6 tháng**. Bấm một ngày trên lịch để xem tình trạng các đơn ngày đó.",
      },
      {
        text: "Bấm **Vào sổ →** (hoặc logo giữa lịch) để mở các tab. Hàng trên là hai nhóm **Quản lý sản xuất** và **Kho, nhân sự & danh mục**; hàng dưới là các tab của nhóm đang chọn. Mỗi người chỉ thấy các tab của vai trò mình.",
      },
      {
        text: "Thanh công cụ của mỗi tab có **✎ Chỉnh sửa**, **✓ Lưu**, **✕ Hủy**, **Lịch sử** và hai nút **⤓ Xuất Excel**, **⤓ Xuất PDF (A4)**.",
      },
    ],
    capabilities: [
      {
        text: "Bấm **✎ Chỉnh sửa** để mở khóa các ô nhập; mọi thay đổi được ghi ngay kèm người sửa và thời gian. **✕ Hủy** hoàn tác mọi thay đổi từ lúc bấm Chỉnh sửa.",
      },
      {
        text: "Xuất đúng những gì đang hiện trên tab ra Excel hoặc PDF A4 có đầu trang công ty.",
      },
      {
        text: "Ở tab **Sản xuất**: nhận đơn, chia việc cho cơ sở, đặt bao bì, nhận hàng cơ sở giao, ký hợp đồng, ghi công nợ, đề nghị tạm ứng / thanh toán, tải hợp đồng gia công Excel / PDF — tùy vai trò.",
      },
    ],
    limits: [
      {
        text: "Vai trò trong Sổ tay lấy theo vai trò khu quản trị (Giám đốc, Quản lý nhà máy, Thủ kho, Kế toán nhà máy, Kế toán công ty). Vai trò QC công ty do Giám đốc gán trong tab **Danh mục & người dùng**.",
      },
      {
        text: "Sổ tay không chứa giá bán. Tiền chỉ vào công nợ cơ sở khi kế toán công ty bấm **Đã chi** ở tab **Chi cho cơ sở**.",
      },
    ],
    flows: [],
    terms: [
      {
        term: "Axx",
        meaning:
          "Kho lưu đối chiếu: cơ sở cũ không còn hiện trong ô chọn nhưng vẫn giữ công nợ cũ.",
      },
      {
        term: "Mốc m1–m5",
        meaning:
          "Mộc giao hàng, hoàn thiện chuyển sang in, in xong, QC lần 1, giao hàng. Đỏ là quá hạn, vàng là sắp đến hạn.",
      },
    ],
    tips: [
      {
        text: "Trang tự làm mới mỗi 15 giây nên thấy được việc người khác vừa ghi.",
      },
    ],
  },
];
