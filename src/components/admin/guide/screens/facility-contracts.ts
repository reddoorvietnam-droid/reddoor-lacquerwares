import type { ScreenGuide } from "../guide-types";

const FM = "FACTORY_MANAGER" as const;
const FA = "FACTORY_ACCOUNTANT" as const;
const CA = "COMPANY_ACCOUNTANT" as const;

export const facilityContractScreens: readonly ScreenGuide[] = [
  /* ---------------------------------------------------------------- */
  /* Hợp đồng cơ sở                                                    */
  /* ---------------------------------------------------------------- */
  {
    path: "/facility-contracts",
    title: "Hợp đồng cơ sở",
    summary:
      "Nơi giữ hợp đồng mua hàng với các cơ sở sản xuất, các đề nghị thanh toán cho cơ sở và số tiền công ty còn phải trả từng cơ sở. Quản lý nhà máy lập hợp đồng và đề nghị thanh toán; Kế toán nhà máy kiểm tra và ghi đã chi; Kế toán công ty duyệt rồi gửi Giám đốc duyệt.",
    layout: [
      {
        text: "Đầu trang có ba nút chuyển: **Hợp đồng**, **Đề nghị thanh toán** và **Công nợ cơ sở**.",
      },
      {
        text: "Mục **Hợp đồng** có ô **Trạng thái**, ô **Tìm kiếm** và nút **Lọc**, rồi bảng với các cột **Mã hợp đồng**, **Cơ sở**, **Đơn hàng**, **Số dòng**, **Giá trị**, **Ngày giao**, **Trạng thái**. Bấm mã hợp đồng để mở trang chi tiết.",
      },
      {
        roles: [FM],
        text: "Phía trên bảng hợp đồng có khung **Tạo hợp đồng** để lập hợp đồng mới.",
      },
      {
        text: "Mục **Đề nghị thanh toán** có bảng với các cột **Mã đề nghị**, **Hợp đồng**, **Cơ sở**, **Số tiền**, **Trạng thái** và **Việc tiếp theo** (ai phải làm bước kế tiếp).",
      },
      {
        text: "Mục **Công nợ cơ sở** có một dòng cho mỗi cơ sở: **HĐ đang thực hiện**, **Giá trị hợp đồng**, **HĐ chưa tính được giá trị**, **Đã chi**, **Đã duyệt, chưa chi** và **Còn phải trả**.",
      },
      {
        text: "Trang chi tiết hợp đồng gồm các khung **Thông tin hợp đồng**, **Hàng hóa và đơn giá**, **Tài liệu hợp đồng** và **Thanh toán cho cơ sở**.",
      },
      {
        text: "Trong khung **Hàng hóa và đơn giá**, cột **Giá lần trước** cho biết đơn giá của cùng mã hàng ở hợp đồng đang thực hiện gần nhất (ở bất kỳ cơ sở nào). Dòng có đơn giá cao hơn hiện nhãn **Cao hơn giá cũ**.",
      },
      {
        text: "Nếu hợp đồng gắn với một đơn hàng mà ngày giao của hợp đồng muộn hơn hạn giao của đơn, cạnh mã hợp đồng hiện nhãn **Giao sau hạn giao của đơn**.",
      },
    ],
    capabilities: [
      {
        text: "Xem mọi hợp đồng cơ sở, mọi đề nghị thanh toán và công nợ từng cơ sở. Đơn giá mua hàng không phải thông tin bị giấu.",
      },
      {
        roles: [FM],
        text: "Tạo hợp đồng nháp: chọn **Cơ sở sản xuất**, gắn **Đơn hàng** nếu có, nhập **Ngày bắt đầu làm hàng**, **Ngày giao hàng** và các dòng hàng (**Mã hàng**, **Chủng loại hàng hóa**, **Số lượng**, **ĐVT**, **Đơn giá (VND)**).",
      },
      {
        roles: [FM],
        text: "Sửa hợp đồng khi còn **Nháp** ở khung **Sửa hợp đồng** rồi bấm **Lưu hợp đồng**.",
      },
      {
        roles: [FM],
        text: "Gửi Giám đốc duyệt giá tăng bằng nút **Gửi Giám đốc duyệt**, rồi bấm **Cho hợp đồng có hiệu lực**.",
      },
      {
        roles: [FM],
        text: "Hủy hợp đồng bằng **Hủy hợp đồng**, ghi **Lý do hủy** rồi bấm **Xác nhận hủy**.",
      },
      {
        roles: [FM],
        text: "Tải lên bản hợp đồng đã ký (**Tải hợp đồng đã ký lên**) và tài liệu khác (**Tải tài liệu khác lên**); gỡ tệp tải nhầm bằng **Gỡ** rồi **Xác nhận gỡ**.",
      },
      {
        roles: [FM],
        text: "Gửi đề nghị thanh toán cho cơ sở trên hợp đồng **Đang thực hiện**: nhập **Số tiền (VND)** rồi bấm **Gửi đề nghị**.",
      },
      {
        roles: [FA],
        text: "Kiểm tra đề nghị đang **Chờ kiểm tra** bằng nút **Đã kiểm tra**, hoặc **Từ chối** kèm lý do.",
      },
      {
        roles: [FA],
        text: "Khi Giám đốc đã duyệt, ghi tiền đã chuyển cho cơ sở: chọn **Ngày chi**, ghi **Ghi chú chi** nếu cần, rồi bấm **Ghi đã chi**.",
      },
      {
        roles: [CA],
        text: "Duyệt đề nghị đang **Chờ kế toán công ty duyệt** bằng nút **Duyệt và gửi Giám đốc**; đề nghị tự được gửi vào hàng chờ duyệt của Giám đốc.",
      },
      {
        roles: [CA],
        text: "Nếu Giám đốc không duyệt, gửi lại bằng **Trình lại Giám đốc**, hoặc **Từ chối** đề nghị kèm lý do.",
      },
    ],
    limits: [
      {
        roles: [FA, CA],
        text: "Không lập, sửa, hủy hợp đồng và không tải tài liệu hợp đồng. Việc đó do Quản lý nhà máy làm.",
      },
      {
        roles: [FA, CA],
        text: "Không gửi đề nghị thanh toán. Quản lý nhà máy gửi đề nghị.",
      },
      {
        roles: [FM],
        text: "Không kiểm tra, duyệt hay ghi đã chi đề nghị thanh toán. Kế toán nhà máy kiểm tra và ghi đã chi; Kế toán công ty và Giám đốc duyệt.",
      },
      {
        text: "Hợp đồng đã có hiệu lực thì không sửa được nữa. Nếu sai, hủy hợp đồng (khi mọi đề nghị thanh toán của nó đã bị từ chối) rồi lập hợp đồng mới.",
      },
      {
        text: "Người gửi đề nghị không tự kiểm tra; người gửi hoặc người kiểm tra không tự duyệt. Nút tương ứng không hiện với họ.",
      },
      {
        text: "Tiền đã chi cho cơ sở không tự ghi vào sổ thu – chi hay chi phí đơn hàng.",
      },
      {
        text: "Chưa nhập được file Excel công nợ cũ; số liệu cũ phải nhập tay bằng hợp đồng và đề nghị thanh toán.",
      },
    ],
    flows: [
      {
        roles: [FM],
        title: "Lập hợp đồng với cơ sở",
        when: "Bạn đã thỏa thuận với một cơ sở về hàng, giá và ngày giao.",
        steps: [
          "Mở mục **Hợp đồng**, tìm khung **Tạo hợp đồng**.",
          "Để trống **Mã hợp đồng** để hệ thống tự đặt mã, hoặc gõ mã trên giấy.",
          "Chọn **Cơ sở sản xuất** và, nếu hàng làm cho một đơn, chọn **Đơn hàng**.",
          "Nhập **Ngày bắt đầu làm hàng** và **Ngày giao hàng**.",
          "Nhập từng dòng: **Mã hàng**, **Chủng loại hàng hóa**, **Số lượng**, **ĐVT**, **Đơn giá (VND)**; bấm **Thêm dòng** để thêm.",
          "Bấm **Tạo hợp đồng**.",
          "Trên trang chi tiết, xem cột **Giá lần trước**. Nếu có dòng **Cao hơn giá cũ**, bấm **Gửi Giám đốc duyệt** và chờ.",
          "Khi được phép, bấm **Cho hợp đồng có hiệu lực**.",
          "Tải bản đã ký bằng **Tải hợp đồng đã ký lên**.",
        ],
        result:
          "Hợp đồng chuyển sang **Đang thực hiện**, được tính vào **Công nợ cơ sở** nếu mọi dòng có số lượng, và có thể gửi đề nghị thanh toán.",
      },
      {
        roles: [FM],
        title: "Đề nghị thanh toán cho cơ sở",
        when: "Cơ sở đến kỳ nhận tiền theo hợp đồng.",
        steps: [
          "Mở hợp đồng **Đang thực hiện**, tìm khung **Thanh toán cho cơ sở**.",
          "Xem **Còn được đề nghị** để biết số tiền tối đa.",
          "Nhập **Số tiền (VND)** và ghi chú, bấm **Gửi đề nghị**.",
        ],
        result:
          "Đề nghị hiện với trạng thái **Chờ kiểm tra**; Kế toán nhà máy làm bước tiếp theo.",
      },
      {
        roles: [FA],
        title: "Kiểm tra và ghi đã chi",
        when: "Có đề nghị **Chờ kiểm tra**, hoặc Giám đốc đã duyệt một đề nghị.",
        steps: [
          "Mở mục **Đề nghị thanh toán**, bấm mã hợp đồng của đề nghị.",
          "Đối chiếu số tiền với hợp đồng và chứng từ, rồi bấm **Đã kiểm tra**; nếu sai, bấm **Từ chối**, ghi **Lý do từ chối** và bấm **Xác nhận từ chối**.",
          "Khi khung **Giám đốc duyệt chi** báo Giám đốc đã duyệt và tiền đã chuyển, chọn **Ngày chi** và bấm **Ghi đã chi**.",
        ],
        result:
          "Đề nghị chuyển sang **Đã chi** và được cộng vào cột **Đã chi** của **Công nợ cơ sở**.",
      },
      {
        roles: [CA],
        title: "Duyệt đề nghị thanh toán",
        when: "Có đề nghị **Chờ kế toán công ty duyệt**.",
        steps: [
          "Mở mục **Đề nghị thanh toán**, lọc **Trạng thái** theo **Chờ kế toán công ty duyệt**.",
          "Bấm mã hợp đồng, xem hợp đồng và số tiền.",
          "Bấm **Duyệt và gửi Giám đốc**, hoặc **Từ chối** kèm lý do.",
          "Nếu khung **Giám đốc duyệt chi** báo Giám đốc không duyệt, sửa điều cần sửa ngoài hệ thống rồi bấm **Trình lại Giám đốc**, hoặc từ chối đề nghị.",
        ],
        result:
          "Đề nghị chuyển sang **Chờ Giám đốc duyệt / chờ chi**; sau khi Giám đốc duyệt, Kế toán nhà máy ghi đã chi.",
      },
    ],
    terms: [
      {
        term: "Nháp",
        meaning:
          "Hợp đồng đang soạn, còn sửa được, chưa được tính vào công nợ.",
      },
      {
        term: "Đang thực hiện",
        meaning:
          "Hợp đồng đã có hiệu lực: được tính vào công nợ và nhận đề nghị thanh toán.",
      },
      { term: "Đã hủy", meaning: "Hợp đồng không còn dùng; có ghi lý do hủy." },
      {
        term: "Giá lần trước",
        meaning:
          "Đơn giá của cùng mã hàng trong hợp đồng đang thực hiện có hiệu lực gần nhất, ở bất kỳ cơ sở nào.",
      },
      {
        term: "Cao hơn giá cũ",
        meaning:
          "Đơn giá mới cao hơn giá lần trước; hợp đồng cần Giám đốc duyệt mới có hiệu lực.",
      },
      {
        term: "HĐ chưa tính được giá trị",
        meaning:
          "Hợp đồng có ít nhất một dòng chưa có số lượng nên chưa tính được tổng tiền.",
      },
      {
        term: "Còn phải trả",
        meaning:
          "Giá trị các hợp đồng đang thực hiện đã tính được, trừ số tiền đã chi.",
      },
      {
        term: "Đã duyệt, chưa chi",
        meaning:
          "Đề nghị Kế toán công ty đã duyệt nhưng chưa ghi đã chi (có thể còn chờ Giám đốc).",
      },
    ],
    tips: [
      {
        roles: [FM],
        text: "Nếu chưa chốt số lượng, để trống ô **Số lượng**. Khi đó hợp đồng không giới hạn tổng tiền đề nghị thanh toán, nên hãy nhập số lượng ngay khi biết.",
      },
      {
        roles: [FM],
        text: "Sửa hợp đồng sau khi Giám đốc đã duyệt giá tăng sẽ làm quyết định cũ hết hiệu lực; phải bấm **Gửi Giám đốc duyệt** lại.",
      },
      {
        text: "Thông báo “Hồ sơ vừa được người khác thay đổi” nghĩa là có người vừa thao tác cùng lúc: tải lại trang rồi làm lại.",
      },
      {
        roles: [FM],
        text: "Thông báo “Tổng các đề nghị thanh toán vượt giá trị hợp đồng” nghĩa là số tiền vượt **Còn được đề nghị**.",
      },
    ],
  },
];
