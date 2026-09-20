import type { ScreenGuide } from "../guide-types";

export const financeBookScreens: readonly ScreenGuide[] = [
  /* ---------------------------------------------------------------- */
  /* Thu – Chi                                                          */
  /* ---------------------------------------------------------------- */
  {
    path: "/finance/ledger",
    title: "Thu – Chi",
    summary:
      "Sổ ghi mọi khoản tiền vào và ra của công ty. Ở đây bạn ghi các khoản thu khác (tiền vào không phải khách trả cho đơn hàng) và hủy phiếu ghi sai. Tiền khách trả được ghi ở trang **Tiền khách trả**, phiếu chi theo đơn được ghi ở trang **Chi phí đơn hàng**; tất cả vẫn hiện trong sổ này.",
    layout: [
      {
        text: "Đầu trang có tiêu đề **Sổ thu – chi** và một đoạn giải thích ngắn.",
      },
      {
        text: "Hai dòng tổng: **Tổng thu** (chữ xanh) và **Tổng chi** (chữ đỏ). Mỗi loại tiền (VND, USD) được cộng riêng, cách nhau bằng dấu “·”. Chỉ cộng các phiếu còn hiệu lực, không cộng phiếu đã hủy.",
      },
      {
        text: "Khung **Ghi phiếu thu khác / phiếu chi** gồm các ô: **Đơn hàng**, **Nhà cung cấp**, **Đối tác / diễn giải**, **Số tiền**, **Tiền tệ**, **Hình thức**, **Ngày**, **Ghi chú** và nút **Ghi phiếu**. Khung không có ô chọn hạng mục: phiếu bạn ghi ở đây luôn là **Thu khác**.",
      },
      {
        text: "Bảng phiếu có các cột: **Ngày**, **Loại**, **Hạng mục**, **Đơn hàng**, **Đối tác**, **Số tiền**, **Phân bổ**, **Hình thức**, **Thao tác**. Ghi chú của phiếu hiện chữ nhỏ ngay dưới hạng mục.",
      },
      {
        text: "Phiếu đã hủy hiện mờ; cột **Thao tác** ghi **Đã hủy** kèm lý do hủy.",
      },
      {
        text: "Bảng hiện tối đa 200 phiếu mới nhất theo ngày của phiếu. Hai dòng tổng được cộng từ các phiếu đang hiện trong bảng.",
      },
      {
        text: "Khi chưa có phiếu nào, bảng hiện dòng “Chưa có phiếu nào trong phạm vi của bạn.”",
      },
    ],
    capabilities: [
      {
        text: "Xem mọi phiếu thu và phiếu chi của công ty: **Khách thanh toán**, **Thu khác**, **Hoàn tiền khách**, các phiếu chi theo đơn và **Chi phí chung**, kể cả phiếu được ghi từ trang khác.",
      },
      {
        text: "Ghi phiếu **Thu khác**: tiền vào không phải là tiền khách trả cho đơn hàng.",
      },
      {
        text: "Gắn phiếu thu khác vào một đơn hàng nếu cần. Ô **Đơn hàng** mặc định là **— Không gắn đơn hàng —**; danh sách đơn không có đơn đã hủy.",
      },
      {
        text: "Chọn **Tiền tệ** VND hoặc USD và **Hình thức** **Chuyển khoản**, **Tiền mặt** hoặc **Khác**.",
      },
      {
        text: "Bấm mã đơn ở cột **Đơn hàng** để mở hồ sơ đơn; bấm tên khách ở cột **Đối tác** để mở trang khách hàng đó.",
      },
      {
        text: "Với phiếu **Khách thanh toán** còn hiệu lực, bấm **Đã phân bổ** hoặc **Chưa phân bổ: …** ở cột **Phân bổ** để mở trang phân bổ của phiếu đó.",
      },
      {
        text: "Hủy bất kỳ phiếu nào còn hiệu lực (phiếu thu hay phiếu chi) bằng cách gõ lý do vào ô **Lý do hủy…** rồi bấm **Hủy phiếu**.",
      },
    ],
    limits: [
      {
        text: "Không ghi tiền khách trả cho đơn hàng ở đây. Dùng trang **Tiền khách trả** để ghi và phân bổ vào hóa đơn hoặc đơn.",
      },
      {
        text: "Không ghi phiếu hoàn tiền cho khách ở đây. Phiếu **Hoàn tiền khách** được ghi từ trang chi tiết của khách hàng hoặc của đơn hàng.",
      },
      {
        text: "Không ghi được phiếu chi ở đây, kể cả **Chi phí chung**. Phiếu chi theo đơn do Kế toán nhà máy ghi ở trang **Chi phí đơn hàng**; **Chi phí chung** chỉ Giám đốc ghi được.",
      },
      {
        text: "Không sửa được phiếu đã ghi (số tiền, ngày, đơn, đối tác). Phiếu sai phải hủy kèm lý do rồi ghi phiếu mới.",
      },
      {
        text: "Không xóa hẳn được phiếu. Phiếu đã hủy vẫn nằm trong sổ để đối chiếu về sau.",
      },
      {
        text: "Không có bước gửi duyệt: phiếu có hiệu lực ngay khi bạn bấm **Ghi phiếu**. Giám đốc không phải duyệt và không có thông báo nào được gửi đi.",
      },
      {
        text: "Trang không có ô tìm kiếm, bộ lọc hay nút xuất tệp.",
      },
    ],
    flows: [
      {
        title: "Ghi một khoản thu khác",
        when: "Công ty nhận một khoản tiền không phải khách trả cho đơn hàng.",
        steps: [
          "Chọn đơn ở ô **Đơn hàng** nếu khoản thu thuộc một đơn; nếu không, giữ **— Không gắn đơn hàng —**.",
          "Giữ nguyên ô **Nhà cung cấp** ở **— Không có trong danh sách —**.",
          "Gõ tên người nộp hoặc nội dung khoản thu vào ô **Đối tác / diễn giải**.",
          "Nhập **Số tiền** và chọn **Tiền tệ**.",
          "Chọn **Hình thức** và kiểm tra **Ngày** nhận tiền.",
          "Nhập **Ghi chú** nếu cần.",
          "Bấm **Ghi phiếu**.",
        ],
        result:
          "Trang báo “Đã ghi phiếu.”. Phiếu hiện trong bảng với **Loại** là **Thu**, **Hạng mục** là **Thu khác** và được cộng vào **Tổng thu**. Không cần ai duyệt.",
      },
      {
        title: "Hủy phiếu ghi sai và ghi lại",
        when: "Bạn phát hiện một phiếu ghi sai số tiền, ngày, đơn hoặc đối tác.",
        steps: [
          "Tìm dòng phiếu sai trong bảng.",
          "Gõ lý do vào ô **Lý do hủy…** ở cột **Thao tác** của dòng đó.",
          "Bấm **Hủy phiếu**.",
          "Kiểm tra dòng đã mờ đi và ghi **Đã hủy** kèm lý do.",
          "Ghi lại phiếu đúng: **Thu khác** thì ghi ở khung **Ghi phiếu thu khác / phiếu chi**; **Khách thanh toán** thì ghi ở trang **Tiền khách trả**.",
          "Báo Kế toán nhà máy ghi lại nếu phiếu vừa hủy là phiếu chi theo đơn.",
        ],
        result:
          "Trang báo “Đã hủy phiếu.”. Phiếu cũ không còn được cộng vào tổng nhưng vẫn giữ trong sổ cùng lý do hủy.",
      },
      {
        title: "Kiểm tra tiền khách trả đã phân bổ hết chưa",
        when: "Bạn rà sổ và muốn biết khoản khách trả đã được gắn vào hóa đơn hoặc đơn nào.",
        steps: [
          "Tìm các dòng có **Hạng mục** là **Khách thanh toán**.",
          "Xem cột **Phân bổ**: chữ xanh **Đã phân bổ** là đã gắn hết; chữ đỏ **Chưa phân bổ: …** là còn tiền chưa gắn.",
          "Bấm vào chữ ở cột **Phân bổ** để mở trang phân bổ của phiếu.",
          "Phân bổ phần còn lại trên trang đó.",
        ],
        result:
          "Sau khi lưu phân bổ, cột **Phân bổ** của phiếu trong sổ đổi theo.",
      },
    ],
    terms: [
      {
        term: "Thu / Chi",
        meaning:
          "Cột **Loại**: **Thu** (chữ xanh) là tiền vào, **Chi** (chữ đỏ) là tiền ra.",
      },
      {
        term: "Khách thanh toán",
        meaning:
          "Tiền khách trả cho đơn hàng. Được ghi ở trang **Tiền khách trả**; ở đây chỉ để xem và hủy.",
      },
      {
        term: "Thu khác",
        meaning: "Tiền vào không phải tiền khách trả cho đơn hàng.",
      },
      {
        term: "Hoàn tiền khách",
        meaning:
          "Tiền trả lại cho khách. Tính là một khoản chi, được ghi từ trang của khách hàng hoặc đơn hàng.",
      },
      {
        term: "Nguyên vật liệu, Nhân công, Gia công ngoài, Vận chuyển, Đóng gói",
        meaning:
          "Các hạng mục chi phí thực tế của một đơn hàng, do Kế toán nhà máy ghi ở trang **Chi phí đơn hàng**.",
      },
      {
        term: "Chi phí chung",
        meaning:
          "Khoản chi không thuộc riêng đơn nào. Hiện trong sổ để xem; chỉ Giám đốc ghi được.",
      },
      {
        term: "Phân bổ",
        meaning:
          "Việc gắn tiền khách trả vào từng hóa đơn hoặc đơn hàng. **Đã phân bổ** là gắn hết; **Chưa phân bổ: …** cho biết số tiền còn chưa gắn. Dấu “—” nghĩa là phiếu không cần phân bổ.",
      },
      {
        term: "Đã hủy",
        meaning:
          "Phiếu đã bị hủy kèm lý do. Phiếu vẫn nằm trong sổ nhưng không được cộng vào tổng.",
      },
      {
        term: "Hình thức",
        meaning: "Cách trả tiền: **Chuyển khoản**, **Tiền mặt** hoặc **Khác**.",
      },
      {
        term: "VND / USD",
        meaning:
          "VND là đồng Việt Nam, USD là đô la Mỹ. Hai loại tiền luôn được cộng riêng, không gộp.",
      },
      {
        term: "Phiếu còn hiệu lực",
        meaning: "Phiếu chưa bị hủy; chỉ những phiếu này được cộng vào tổng.",
      },
    ],
    tips: [
      {
        text: "Gõ số tiền liền, không có dấu chấm hay dấu phẩy ngăn nghìn, ví dụ 1500000. Tiền USD có số lẻ thì dùng dấu chấm, ví dụ 1250.50. VND không có số lẻ; USD tối đa 2 số lẻ.",
      },
      {
        text: "Ô **Nhà cung cấp** chỉ có lựa chọn **— Không có trong danh sách —**, nên bạn luôn phải gõ ô **Đối tác / diễn giải**. Bỏ trống ô này thì trang báo “Dữ liệu nhập chưa hợp lệ.”.",
      },
      {
        text: "Ô **Ngày** mặc định là ngày hôm nay (trước 7 giờ sáng có thể hiện ngày hôm trước). Hãy sửa thành ngày tiền thật sự vào.",
      },
      {
        text: "Phiếu bằng USD được ghi kèm tỷ giá gần nhất tính đến ngày của phiếu trong bảng **Tỷ giá USD**; nếu bảng chưa có tỷ giá, phiếu vẫn được ghi nhưng không kèm tỷ giá. Nên nhập tỷ giá trước khi ghi phiếu USD.",
      },
      {
        text: "Ô **Lý do hủy…** bắt buộc. Ghi lý do rõ ràng, ví dụ “ghi trùng” hoặc “sai số tiền”, vì lý do được giữ mãi trong sổ.",
      },
      {
        text: "Thông báo xanh “Đã ghi phiếu.” hoặc “Đã hủy phiếu.” nghĩa là thao tác đã xong.",
      },
      {
        text: "Thông báo đỏ luôn bắt đầu bằng “Thao tác không thành công:”. Các lỗi hay gặp: “Dữ liệu nhập chưa hợp lệ.” (thiếu đối tác, số tiền bằng 0 hoặc ngày sai); “Số tiền không hợp lệ với loại tiền đã chọn.” (VND có số lẻ, hoặc USD quá 2 số lẻ); “Không tìm thấy đơn hàng.”.",
      },
      {
        text: "“Loại tiền không khớp với đơn hàng hoặc hóa đơn.” xuất hiện khi bạn gắn khoản **Thu khác** vào một đơn có giá bán bằng loại tiền khác. “Đơn hàng đã hủy, không ghi nhận tiền thu vào đơn này.” xuất hiện khi đơn vừa bị hủy trong lúc bạn đang ghi phiếu.",
      },
      {
        text: "“Bản ghi đã thay đổi trong lúc bạn thao tác. Trang đã tải lại, kiểm tra rồi thử lại.” nghĩa là phiếu vừa được thay đổi ở nơi khác; xem lại dòng đó rồi làm lại. “Bản ghi đã hủy trước đó.” nghĩa là phiếu đã bị hủy rồi.",
      },
      {
        text: "“Hệ thống tạm thời không phản hồi.”: đợi một lát rồi thử lại. “Bạn không có quyền thực hiện thao tác này.”: báo Giám đốc kiểm tra tài khoản của bạn.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Chi phí đơn hàng                                                   */
  /* ---------------------------------------------------------------- */
  {
    path: "/finance/expenses",
    title: "Chi phí đơn hàng",
    summary:
      "Nơi ghi và xem từng khoản chi thực tế ở xưởng cho một đơn hàng: nguyên vật liệu, nhân công, gia công ngoài, vận chuyển, đóng gói. Tổng chi phí của đơn được cộng từ các phiếu còn hiệu lực.",
    layout: [
      {
        text: "Đầu trang có tiêu đề **Chi phí đơn hàng** và một đoạn giải thích ngắn.",
      },
      {
        text: "Dòng **Tổng đã chi (phiếu còn hiệu lực)**: cộng các phiếu chưa hủy trong bảng, mỗi loại tiền (VND, USD) cộng riêng.",
      },
      {
        text: "Khung **Ghi phiếu chi theo đơn** gồm các ô: **Đơn hàng**, **Hạng mục**, **Nhà cung cấp**, **Đối tác / diễn giải**, **Số tiền**, **Tiền tệ**, **Hình thức**, **Ngày**, **Ghi chú** và nút **Ghi phiếu**.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Trang không hiện khung ghi phiếu cho bạn; bạn chỉ thấy dòng tổng và bảng phiếu.",
        roles: ["FACTORY_MANAGER", "COMPANY_ACCOUNTANT"],
      },
      {
        text: "Bảng phiếu có các cột: **Ngày**, **Hạng mục** (ghi chú hiện chữ nhỏ bên dưới), **Đơn hàng**, **Đối tác**, **Số tiền**, **Hình thức**, **Thao tác**.",
      },
      {
        text: "Bảng gồm mọi phiếu chi của công ty, kể cả phiếu **Chi phí chung** không gắn đơn, trừ phiếu hoàn tiền cho khách. Bảng hiện tối đa 200 phiếu mới nhất theo ngày.",
      },
      {
        text: "Phiếu đã hủy hiện mờ; cột **Thao tác** ghi **Đã hủy** kèm lý do.",
      },
      {
        text: "Khi chưa có phiếu nào, bảng hiện dòng “Chưa có phiếu nào trong phạm vi của bạn.”",
      },
    ],
    capabilities: [
      {
        text: "Xem mọi phiếu chi: ngày, hạng mục, đơn, đối tác, số tiền, hình thức và ghi chú.",
      },
      {
        text: "Bấm mã đơn ở cột **Đơn hàng** để mở hồ sơ đơn đó.",
      },
      {
        text: "Ghi phiếu chi gắn với một đơn hàng. Ô **Đơn hàng** là bắt buộc; danh sách không có đơn đã hủy.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Chọn hạng mục **Nguyên vật liệu**, **Nhân công**, **Gia công ngoài**, **Vận chuyển** hoặc **Đóng gói**.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Chọn nhà cung cấp đang hoạt động từ danh sách, hoặc chọn **— Không có trong danh sách —** rồi gõ diễn giải vào ô **Đối tác / diễn giải**.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Chọn **Tiền tệ** VND hoặc USD và **Hình thức** **Chuyển khoản**, **Tiền mặt** hoặc **Khác**.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Hủy phiếu chi còn hiệu lực: gõ lý do vào ô **Lý do hủy…** rồi bấm **Hủy phiếu**.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
    ],
    limits: [
      {
        text: "Bạn không ghi được phiếu chi trên trang này. Khi xưởng có khoản chi, hãy báo Kế toán nhà máy để ghi.",
        roles: ["FACTORY_MANAGER"],
      },
      {
        text: "Bạn không ghi được phiếu chi trên trang này; phiếu chi do Kế toán nhà máy ghi. Ở đây bạn xem và hủy phiếu sai.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Bạn không hủy được phiếu; cột **Thao tác** chỉ hiện “—”. Phiếu ghi sai phải nhờ Kế toán công ty hủy.",
        roles: ["FACTORY_MANAGER", "FACTORY_ACCOUNTANT"],
      },
      {
        text: "Không sửa được phiếu đã ghi. Phiếu sai phải được hủy kèm lý do rồi ghi phiếu mới.",
      },
      {
        text: "Trang không có bản nháp, không có bước gửi duyệt, duyệt hay từ chối: phiếu có hiệu lực ngay khi được ghi. Không có thông báo nào được gửi đi.",
      },
      {
        text: "Không ghi được khoản chi không gắn đơn (**Chi phí chung**) ở trang này; khoản đó do Giám đốc ghi.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Đơn đã hủy không có trong danh sách chọn ở ô **Đơn hàng**.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Trang không có ô tìm kiếm, bộ lọc hay nút xuất tệp.",
      },
    ],
    flows: [
      {
        title: "Ghi phiếu chi cho một đơn hàng",
        when: "Xưởng vừa chi tiền mua vật liệu, trả công, thuê gia công, vận chuyển hoặc đóng gói cho một đơn.",
        steps: [
          "Chọn đơn ở ô **Đơn hàng** (mỗi dòng ghi mã đơn · tên khách).",
          "Chọn hạng mục ở ô **Hạng mục**.",
          "Chọn nhà cung cấp ở ô **Nhà cung cấp**; nếu không có, chọn **— Không có trong danh sách —**.",
          "Gõ tên người nhận hoặc nội dung chi vào ô **Đối tác / diễn giải** khi không chọn nhà cung cấp.",
          "Nhập **Số tiền** và chọn **Tiền tệ**.",
          "Chọn **Hình thức** và kiểm tra **Ngày** chi tiền.",
          "Nhập **Ghi chú** nếu cần, ví dụ số phiếu nhập hay nội dung hóa đơn mua.",
          "Bấm **Ghi phiếu**.",
        ],
        result:
          "Trang báo “Đã ghi phiếu.”. Phiếu hiện trong bảng và được cộng vào **Tổng đã chi (phiếu còn hiệu lực)** cùng tổng chi phí của đơn. Phiếu có hiệu lực ngay, không cần ai duyệt.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        title: "Hủy phiếu chi ghi sai",
        when: "Một phiếu chi bị ghi trùng hoặc sai số tiền, đơn, hạng mục.",
        steps: [
          "Tìm dòng phiếu sai trong bảng.",
          "Gõ lý do vào ô **Lý do hủy…** ở cột **Thao tác**.",
          "Bấm **Hủy phiếu**.",
          "Kiểm tra dòng đã mờ đi và ghi **Đã hủy** kèm lý do.",
          "Báo Kế toán nhà máy ghi lại phiếu đúng.",
        ],
        result:
          "Trang báo “Đã hủy phiếu.”. Phiếu cũ không còn được cộng vào tổng nhưng vẫn giữ trong sổ cùng lý do hủy.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        title: "Xử lý khi phát hiện phiếu ghi sai",
        when: "Bạn thấy một phiếu chi sai nhưng không có nút hủy.",
        steps: [
          "Ghi lại ngày, mã đơn, đối tác và số tiền của dòng sai.",
          "Báo Kế toán công ty để hủy phiếu đó.",
          "Mở lại trang và kiểm tra dòng đã ghi **Đã hủy**.",
          "Ghi lại phiếu đúng bằng khung **Ghi phiếu chi theo đơn**.",
        ],
        result:
          "Phiếu sai không còn được cộng vào tổng; phiếu đúng thay thế nó.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        title: "Báo một khoản chi cần ghi hoặc cần sửa",
        when: "Xưởng vừa chi tiền cho một đơn, hoặc bạn thấy một phiếu chi ghi sai.",
        steps: [
          "Ghi lại mã đơn, hạng mục, người nhận, số tiền và ngày chi.",
          "Báo Kế toán nhà máy để ghi phiếu chi mới.",
          "Báo Kế toán công ty nếu cần hủy một phiếu ghi sai.",
          "Mở lại trang và kiểm tra phiếu đã hiện đúng trong bảng.",
        ],
        result:
          "Kế toán ghi hoặc hủy phiếu; bảng và dòng tổng đổi theo ngay khi bạn mở lại trang.",
        roles: ["FACTORY_MANAGER"],
      },
      {
        title: "Tra các khoản đã chi của một đơn",
        when: "Bạn cần biết một đơn đã tốn những khoản gì.",
        steps: [
          "Bấm Ctrl + F trên bàn phím và gõ mã đơn để tìm các dòng của đơn trong bảng.",
          "Xem **Hạng mục**, **Đối tác** và **Số tiền** của từng dòng, bỏ qua các dòng **Đã hủy**.",
          "Bấm mã đơn ở cột **Đơn hàng** để mở hồ sơ đơn nếu cần xem thêm.",
        ],
        result:
          "Bạn nắm được các khoản chi còn hiệu lực của đơn trong 200 phiếu mới nhất; trang không thay đổi gì.",
      },
    ],
    terms: [
      {
        term: "Nguyên vật liệu, Nhân công, Gia công ngoài, Vận chuyển, Đóng gói",
        meaning: "Năm hạng mục chi phí thực tế của một đơn hàng.",
      },
      {
        term: "Chi phí chung",
        meaning:
          "Khoản chi không thuộc riêng đơn nào. Hiện trong bảng để xem nhưng không ghi được ở trang này.",
      },
      {
        term: "Đối tác",
        meaning:
          "Người nhận tiền: tên nhà cung cấp đã chọn, hoặc chữ đã gõ ở ô **Đối tác / diễn giải**.",
      },
      {
        term: "Hình thức",
        meaning: "Cách trả tiền: **Chuyển khoản**, **Tiền mặt** hoặc **Khác**.",
      },
      {
        term: "Tổng đã chi (phiếu còn hiệu lực)",
        meaning:
          "Tổng tiền của các phiếu chưa hủy đang hiện trong bảng, mỗi loại tiền cộng riêng.",
      },
      {
        term: "Đã hủy",
        meaning:
          "Phiếu đã bị hủy kèm lý do; vẫn nằm trong sổ nhưng không được cộng vào tổng.",
      },
      {
        term: "“—” ở cột Đơn hàng",
        meaning: "Phiếu không gắn với đơn nào, ví dụ **Chi phí chung**.",
      },
      {
        term: "“—” ở cột Thao tác",
        meaning: "Bạn không có thao tác nào với phiếu này.",
        roles: ["FACTORY_MANAGER", "FACTORY_ACCOUNTANT"],
      },
      {
        term: "VND / USD",
        meaning:
          "VND là đồng Việt Nam, USD là đô la Mỹ. Hai loại tiền luôn được cộng riêng.",
      },
    ],
    tips: [
      {
        text: "Gõ số tiền liền, không có dấu chấm hay dấu phẩy ngăn nghìn, ví dụ 1500000. Tiền USD có số lẻ thì dùng dấu chấm, ví dụ 320.75. VND không có số lẻ; USD tối đa 2 số lẻ.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Phiếu chi ghi được bằng VND hoặc USD, không cần trùng loại tiền với giá bán của đơn.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Nếu không chọn nhà cung cấp mà cũng bỏ trống ô **Đối tác / diễn giải**, trang báo “Thao tác không thành công: Dữ liệu nhập chưa hợp lệ.”. Khi đã chọn nhà cung cấp, tên nhà cung cấp được ghi vào phiếu thay cho chữ bạn gõ.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Nhà cung cấp chưa có trong danh sách: bạn có thể thêm ở mục **Nhà cung cấp** trên menu rồi quay lại ghi phiếu, để các khoản chi cho cùng một nơi luôn mang cùng một tên. Danh sách chỉ có nhà cung cấp đang hoạt động.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Ô **Ngày** mặc định là ngày hôm nay (trước 7 giờ sáng có thể hiện ngày hôm trước); hãy sửa thành ngày chi tiền thật.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Kiểm tra kỹ trước khi bấm **Ghi phiếu**: phiếu có hiệu lực ngay và bạn không tự hủy được.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Ô **Lý do hủy…** bắt buộc; lý do được giữ mãi cùng phiếu.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Thông báo xanh “Đã ghi phiếu.” nghĩa là phiếu đã được ghi.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "Thông báo xanh “Đã hủy phiếu.” nghĩa là phiếu đã được hủy.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Thông báo đỏ bắt đầu bằng “Thao tác không thành công:”. Hay gặp: “Số tiền không hợp lệ với loại tiền đã chọn.” (VND có số lẻ, hoặc USD quá 2 số lẻ); “Không tìm thấy đơn hàng.”; “Không tìm thấy nhà cung cấp.”.",
        roles: ["FACTORY_ACCOUNTANT"],
      },
      {
        text: "“Bản ghi đã thay đổi trong lúc bạn thao tác. Trang đã tải lại, kiểm tra rồi thử lại.” nghĩa là phiếu vừa bị thay đổi ở nơi khác. “Bản ghi đã hủy trước đó.” nghĩa là phiếu đã được hủy rồi.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "“Hệ thống tạm thời không phản hồi.”: đợi một lát rồi thử lại. “Bạn không có quyền thực hiện thao tác này.”: báo Giám đốc kiểm tra tài khoản của bạn.",
        roles: ["FACTORY_ACCOUNTANT", "COMPANY_ACCOUNTANT"],
      },
      {
        text: "Dòng tổng ở đầu trang là tổng của mọi phiếu đang hiện, không phải của riêng một đơn. Muốn biết chi phí một đơn, hãy xem các dòng mang mã đơn đó.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Tỷ giá USD                                                         */
  /* ---------------------------------------------------------------- */
  {
    path: "/finance/fx",
    title: "Tỷ giá USD",
    summary:
      "Bảng tỷ giá USD sang VND theo từng ngày do bạn nhập. Khi lập hóa đơn USD mà không gõ tỷ giá riêng, hóa đơn lấy tỷ giá của ngày lập từ bảng này và giữ nguyên về sau; ngày chưa có tỷ giá thì dùng tỷ giá gần nhất trước đó.",
    layout: [
      {
        text: "Đầu trang có tiêu đề **Tỷ giá USD → VND** và đoạn giải thích cách hóa đơn USD dùng bảng này.",
      },
      {
        text: "Khung **Nhập tỷ giá** gồm ô **Ngày** (mặc định là ngày hôm nay), ô **VND cho 1 USD**, ô **Nguồn (PublicBank, Hải quan…)** và nút **Lưu tỷ giá**.",
      },
      {
        text: "Bảng tỷ giá có các cột **Ngày**, **Tỷ giá**, **Nguồn**, **Cập nhật**, ngày mới nhất ở trên cùng.",
      },
      {
        text: "Bảng hiện tối đa 90 ngày có tỷ giá gần nhất.",
      },
      {
        text: "Khi chưa có tỷ giá nào, trang hiện dòng “Chưa có tỷ giá nào. Hóa đơn USD sẽ yêu cầu nhập tỷ giá thủ công cho đến khi bảng này có dữ liệu.”",
      },
    ],
    capabilities: [
      {
        text: "Nhập tỷ giá cho một ngày bất kỳ, kể cả ngày đã qua.",
      },
      {
        text: "Sửa tỷ giá đã nhập: nhập lại cùng ngày đó, tỷ giá mới thay cho tỷ giá cũ.",
      },
      {
        text: "Ghi nguồn tỷ giá (ngân hàng, hải quan…) vào ô **Nguồn (PublicBank, Hải quan…)**; ô này có thể bỏ trống.",
      },
      {
        text: "Xem lại tỷ giá, nguồn và thời điểm cập nhật của từng ngày.",
      },
    ],
    limits: [
      {
        text: "Không có nút xóa tỷ giá. Tỷ giá nhập sai được sửa bằng cách nhập lại đúng ngày đó.",
      },
      {
        text: "Hệ thống không tự lấy tỷ giá ngân hàng; bạn tự chọn và nhập tỷ giá theo quy định đang áp dụng.",
      },
      {
        text: "Sửa bảng không làm đổi hóa đơn USD đã lập hay phiếu thu, chi USD đã ghi: mỗi bản giữ tỷ giá lúc được lập.",
      },
      {
        text: "Chỉ có tỷ giá USD sang VND; không có loại tiền nào khác.",
      },
      {
        text: "Cột **Cập nhật** chỉ ghi thời điểm lưu, không ghi tên người nhập.",
      },
    ],
    flows: [
      {
        title: "Nhập tỷ giá trong ngày",
        when: "Đầu ngày làm việc, hoặc trước khi lập hóa đơn USD.",
        steps: [
          "Kiểm tra ô **Ngày** đúng ngày cần nhập.",
          "Nhập tỷ giá vào ô **VND cho 1 USD**, ví dụ 25400.",
          "Nhập nguồn vào ô **Nguồn (PublicBank, Hải quan…)**, ví dụ “PublicBank”.",
          "Bấm **Lưu tỷ giá**.",
          "Kiểm tra dòng mới trong bảng: **Ngày**, **Tỷ giá**, **Nguồn** đúng như đã nhập.",
        ],
        result:
          "Trang báo “Đã lưu tỷ giá.”. Hóa đơn USD lập trong ngày đó, và những ngày sau chưa có tỷ giá, sẽ lấy tỷ giá này khi không gõ tỷ giá riêng.",
      },
      {
        title: "Sửa tỷ giá nhập sai",
        when: "Bạn phát hiện tỷ giá của một ngày bị gõ sai.",
        steps: [
          "Chọn đúng ngày bị sai ở ô **Ngày**.",
          "Nhập tỷ giá đúng vào ô **VND cho 1 USD**.",
          "Nhập lại nguồn nếu cần.",
          "Bấm **Lưu tỷ giá**.",
          "Kiểm tra dòng của ngày đó trong bảng đã đổi và cột **Cập nhật** mang thời điểm mới.",
        ],
        result:
          "Tỷ giá mới thay cho tỷ giá cũ của ngày đó. Hóa đơn USD đã lập trước khi sửa vẫn giữ tỷ giá cũ.",
      },
      {
        title: "Xử lý khi hóa đơn USD báo thiếu tỷ giá",
        when: "Lúc lập hóa đơn USD, trang báo “Hóa đơn USD cần tỷ giá. Nhập tỷ giá vào ô hoặc thêm tỷ giá của ngày lập vào bảng tỷ giá.”",
        steps: [
          "Mở mục **Tỷ giá USD** trên menu.",
          "Chọn ngày lập hóa đơn ở ô **Ngày**.",
          "Nhập tỷ giá và nguồn.",
          "Bấm **Lưu tỷ giá**.",
          "Quay lại trang hóa đơn và lập lại hóa đơn, để trống ô tỷ giá trên hóa đơn.",
        ],
        result:
          "Hóa đơn USD lấy tỷ giá vừa nhập và giữ nguyên về sau. Bạn cũng có thể gõ thẳng tỷ giá vào ô trên hóa đơn thay vì thêm vào bảng.",
      },
    ],
    terms: [
      {
        term: "USD / VND",
        meaning: "USD là đô la Mỹ, VND là đồng Việt Nam.",
      },
      {
        term: "Tỷ giá",
        meaning: "Số đồng Việt Nam đổi được 1 đô la Mỹ trong ngày đó.",
      },
      {
        term: "Nguồn",
        meaning:
          "Nơi lấy tỷ giá, ví dụ ngân hàng hay hải quan. Dấu “—” nghĩa là không ghi nguồn.",
      },
      {
        term: "Cập nhật",
        meaning: "Ngày giờ tỷ giá của dòng đó được lưu lần gần nhất.",
      },
      {
        term: "Tỷ giá gần nhất trước đó",
        meaning:
          "Ngày chưa có tỷ giá thì hệ thống dùng tỷ giá của ngày gần nhất trước ngày đó có trong bảng.",
      },
    ],
    tips: [
      {
        text: "Gõ tỷ giá liền, không dấu chấm hay dấu phẩy ngăn nghìn: 25400. Nếu có số lẻ, dùng dấu chấm: 25400.5. Gõ sai dạng thì trình duyệt không cho lưu.",
      },
      {
        text: "Mỗi ngày chỉ có một tỷ giá. Lưu lần hai cho cùng ngày sẽ thay tỷ giá cũ, không tạo thêm dòng.",
      },
      {
        text: "Ô **Ngày** mặc định là ngày hôm nay (trước 7 giờ sáng có thể hiện ngày hôm trước); luôn kiểm tra trước khi lưu.",
      },
      {
        text: "Nên nhập tỷ giá trước khi lập hóa đơn USD hoặc ghi phiếu bằng USD. Phiếu thu, chi bằng USD cũng được ghi kèm tỷ giá gần nhất tính đến ngày của phiếu.",
      },
      {
        text: "Luôn ghi **Nguồn** để sau này đối chiếu được tỷ giá lấy từ đâu.",
      },
      {
        text: "Thông báo xanh “Đã lưu tỷ giá.” nghĩa là đã lưu xong.",
      },
      {
        text: "Thông báo đỏ “Thao tác không thành công: Dữ liệu nhập chưa hợp lệ.” thường do tỷ giá bằng 0 hoặc ngày không hợp lệ. “Hệ thống tạm thời không phản hồi.”: đợi một lát rồi thử lại.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Kiểm tra bảng biểu                                                 */
  /* ---------------------------------------------------------------- */
  {
    path: "/checks",
    title: "Kiểm tra bảng biểu",
    summary:
      "Tải một bảng Excel hoặc CSV (báo cáo tiền về, bảng công nợ, danh sách đơn hàng) lên để hệ thống đọc từng ô, kiểm tra định dạng và so với dữ liệu trong phần mềm. Kết quả chỉ để xem: không sửa gì trong hệ thống và không lưu tệp gốc.",
    layout: [
      {
        text: "Trang danh sách có tiêu đề **Kiểm tra bảng biểu, dư nợ**, đoạn giải thích và hai ô: **Kiểm tra làm gì** và những việc kiểm tra không làm.",
      },
      {
        text: "Nút **Tải bảng mới** ở góc trên bên phải.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Hai hàng nút lọc: **Loại bảng** (**Tất cả**, **Báo cáo tiền về**, **Báo cáo công nợ / dư nợ**, **Danh sách đơn hàng**) và **Trạng thái** (**Tất cả**, **Chờ chọn cột**, **Đã kiểm tra**).",
      },
      {
        text: "Bảng danh sách có các cột **Tệp** (tên tệp, dạng tệp và tên sheet), **Loại bảng**, **Trạng thái**, **Ngày tải**, **Dòng dữ liệu**, **Lỗi / cảnh báo**, **Người tải** và liên kết **Mở →**. Mỗi trang hiện 50 bản, chuyển trang bằng **← Trước** và **Sau →**.",
      },
      {
        text: "Trang **Tải bảng lên** (mở bằng **Tải bảng mới**): chọn **Loại bảng**, chọn **Tệp (.xlsx, .xls, .csv)**, ô **Sheet (tùy chọn)**, nút **Đọc bảng**, bên cạnh là ô **Quy tắc**.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Bản kiểm tra ở trạng thái **Chờ chọn cột** mở ra phần **Xác nhận cột**: thông tin **Sheet**, **Dòng tiêu đề**, **Dòng dữ liệu**, **Bản nháp tự xóa vào**; bảng cột gồm **Cột**, **Tiêu đề trong tệp**, **Ví dụ**, **Ý nghĩa**, **Đơn vị**, **Kiểu số**, **Tiền tệ của cột**, **Định dạng ngày**; ô **Thiết lập chung** và nút **Chạy kiểm tra**.",
      },
      {
        text: "Cuối phần **Xác nhận cột** có nút **Hủy bản nháp**.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Bản kiểm tra **Đã kiểm tra** mở ra trang kết quả: dòng **Kiểm tra lúc**, **Dữ liệu hệ thống lấy lúc**, **Kết quả tự xóa vào**; các nút thao tác; **Tổng quan** (các ô **Dòng dữ liệu**, **Dòng bỏ qua**, **Khớp**, **Lệch**, **Không thấy**, **Không đối chiếu**, **Không đọc được**, **Lỗi**, **Cảnh báo**, **Thông tin**); **Tổng cộng theo cột**; **Phát hiện chung**; **Có trong hệ thống nhưng không có trong bảng** và **Từng dòng**.",
      },
      {
        text: "Bảng **Từng dòng** có các cột **Dòng**, **Loại**, **Ngày**, **Đối tượng**, **Số tiền (bảng)**, **Kết quả**, **Mức**, **Chi tiết** (cột ngày, đối tượng, số tiền chỉ hiện khi đã chọn cột tương ứng); mỗi trang 200 dòng.",
      },
      {
        text: "Mọi trang con có liên kết **← Kiểm tra bảng biểu** ở trên cùng để quay về danh sách.",
      },
    ],
    capabilities: [
      {
        text: "Xem danh sách các bản kiểm tra bạn được phép mở, lọc theo **Loại bảng** và **Trạng thái**, rồi bấm tên tệp hoặc **Mở →** để xem.",
      },
      {
        text: "Tải bảng loại **Danh sách đơn hàng**: bảng bất kỳ có cột mã đơn; hệ thống so trạng thái đơn và khách với đơn trong phần mềm.",
        roles: ["WAREHOUSE_MANAGER", "FACTORY_ACCOUNTANT"],
      },
      {
        text: "Tải cả ba loại bảng: **Báo cáo tiền về** (so với phiếu thu của khách), **Báo cáo công nợ / dư nợ** (so với công nợ trong hệ thống) và **Danh sách đơn hàng** (so trạng thái, khách, hóa đơn và nếu chọn thì cả giá bán).",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Trên phần **Xác nhận cột**: sửa **Ý nghĩa** của từng cột, chọn **Đơn vị** (**Đơn vị gốc**, **× 1.000**, **× 1.000.000**), **Kiểu số**, **Tiền tệ của cột**, **Định dạng ngày**; đặt **Tiền tệ khi ô không ghi** và kỳ báo cáo **Kỳ báo cáo từ ngày** / **đến ngày**.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Với **Danh sách đơn hàng**, đánh dấu ô **So cột số tiền với giá bán của đơn (chỉ khi bạn có quyền xem giá bán)** để so số tiền trên bảng với giá bán của đơn.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Bấm **Chạy kiểm tra** để chạy; bấm **Hủy bản nháp** để bỏ một bản chưa chạy.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Bấm **Xuất CSV** trên trang kết quả để tải kết quả về máy, mở bằng Excel.",
      },
      {
        text: "Bấm **Chạy lại với tệp này** để tạo bản kiểm tra mới từ bảng đã đọc, không cần tải lại tệp, khi muốn chọn cột khác hoặc so với dữ liệu mới nhất.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Trên trang kết quả: lọc **Từng dòng** bằng **Có cảnh báo / lỗi** hoặc **Tất cả dòng**; bấm **Chi tiết** của một dòng để xem **Phát hiện**, phần **Hệ thống** và **Ô trong bảng**.",
      },
    ],
    limits: [
      {
        text: "Bạn chỉ xem và xuất CSV được. Trang không có nút **Tải bảng mới**, **Chạy lại với tệp này** và **Hủy bản nháp**. Bạn mở được bản nháp nhưng nếu bấm **Chạy kiểm tra** trang sẽ báo “Bạn không có quyền thực hiện thao tác này.”. Việc tải và chạy do Thủ kho, Kế toán nhà máy hoặc Kế toán công ty làm.",
        roles: ["FACTORY_MANAGER"],
      },
      {
        text: "Bạn chỉ tải được loại **Danh sách đơn hàng**. **Báo cáo tiền về** và **Báo cáo công nợ / dư nợ** do Kế toán công ty kiểm tra.",
        roles: ["WAREHOUSE_MANAGER", "FACTORY_ACCOUNTANT"],
      },
      {
        text: "Bạn không xem được bản kiểm tra nào có đối chiếu tiền của khách: mọi bản **Báo cáo tiền về**, **Báo cáo công nợ / dư nợ**, và bản **Danh sách đơn hàng** đã chạy có dùng giá bán, hóa đơn, tiền khách trả hoặc danh sách khách hàng. Các bản đó không hiện trong danh sách của bạn.",
        roles: ["WAREHOUSE_MANAGER", "FACTORY_MANAGER", "FACTORY_ACCOUNTANT"],
      },
      {
        text: "Khi bạn chạy **Danh sách đơn hàng**, cột số tiền chỉ được kiểm tra định dạng và cộng dồn, không so với hệ thống; **Phát hiện chung** sẽ ghi một dòng **Thông tin** về việc này.",
        roles: ["WAREHOUSE_MANAGER", "FACTORY_ACCOUNTANT"],
      },
      {
        text: "Kiểm tra không ghi gì vào hệ thống: không tạo phiếu thu, hóa đơn, đơn hàng hay việc. Muốn sửa số liệu, bạn phải sửa ở trang nghiệp vụ tương ứng.",
      },
      {
        text: "Chưa đối soát với sao kê ngân hàng; chỉ so với sổ trong phần mềm.",
      },
      {
        text: "Chưa đọc được ảnh chụp bảng; chỉ nhận tệp .xlsx, .xls, .csv. Tệp có macro (.xlsm) bị từ chối.",
      },
      {
        text: "Kết quả đã chạy không sửa và không hủy được; kết quả tự xóa vào ngày ghi ở **Kết quả tự xóa vào**. Bản nháp chưa chạy tự xóa sau 7 ngày.",
      },
      {
        text: "Tệp gốc không được lưu, nên không tải lại được tệp từ trang này; chỉ **Xuất CSV** được kết quả.",
      },
    ],
    flows: [
      {
        title: "Kiểm tra một danh sách đơn hàng",
        when: "Bạn nhận một bảng Excel có cột mã đơn (ví dụ gửi qua nhóm Zalo) và muốn biết đơn, khách, trạng thái có khớp phần mềm không.",
        steps: [
          "Bấm **Tải bảng mới**.",
          "Chọn **Danh sách đơn hàng** ở mục **Loại bảng**.",
          "Bấm ô **Tệp (.xlsx, .xls, .csv)** và chọn tệp trên máy.",
          "Gõ số thứ tự hoặc tên sheet vào ô **Sheet (tùy chọn)** nếu bảng không nằm ở sheet đầu tiên có dữ liệu.",
          "Bấm **Đọc bảng** và chờ phần **Xác nhận cột** mở ra.",
          "Kiểm tra cột **Ý nghĩa**: cột mã đơn phải là **Mã đơn**; cột không cần so chọn **Bỏ qua**.",
          "Bấm **Chạy kiểm tra**.",
          "Xem **Tổng quan** và các dòng trong **Từng dòng**, bấm **Chi tiết** ở dòng có **Lỗi** hoặc **Cảnh báo**.",
        ],
        result:
          "Trang báo “Đã chạy kiểm tra. Kết quả bên dưới không thay đổi được nữa.”. Trạng thái đổi sang **Đã kiểm tra**. Không có gì trong hệ thống bị thay đổi và không có thông báo nào được gửi đi.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        title: "Đối chiếu báo cáo tiền về",
        when: "Có bảng liệt kê các khoản khách chuyển tiền và bạn cần biết khoản nào đã có phiếu thu.",
        steps: [
          "Bấm **Tải bảng mới**, chọn **Báo cáo tiền về**, chọn tệp rồi bấm **Đọc bảng**.",
          "Kiểm tra cột **Ý nghĩa**: phải có **Ngày**, **Số tiền** và ít nhất một trong **Tên khách**, **Mã khách**, **Mã đơn**, **Số hóa đơn**.",
          "Chọn **× 1.000** ở cột **Đơn vị** nếu bảng ghi tiền theo nghìn đồng.",
          "Chọn **Định dạng ngày** nếu cột ngày ghi “mâu thuẫn — hãy chọn”.",
          "Nhập **Kỳ báo cáo từ ngày** và **đến ngày** (nhập cả hai hoặc bỏ trống cả hai).",
          "Bấm **Chạy kiểm tra**.",
          "Xem dòng **Không thấy** và **Lệch** trong **Từng dòng**, rồi xem mục **Có trong hệ thống nhưng không có trong bảng**.",
          "Ghi phiếu thu còn thiếu ở trang **Tiền khách trả**; phiếu thu sai thì hủy rồi ghi lại ở đó.",
        ],
        result:
          "Bạn có danh sách khoản tiền đã khớp, bị lệch và chưa có phiếu thu. Kết quả được giữ nguyên; muốn so lại sau khi sửa sổ, bấm **Chạy lại với tệp này**.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        title: "Đối chiếu bảng công nợ",
        when: "Có bảng dư nợ cuối kỳ của khách và bạn cần so với công nợ trong phần mềm.",
        steps: [
          "Bấm **Tải bảng mới**, chọn **Báo cáo công nợ / dư nợ**, chọn tệp rồi bấm **Đọc bảng**.",
          "Kiểm tra cột **Ý nghĩa**: phải có **Dư nợ cuối kỳ** và ít nhất một trong **Tên khách**, **Mã khách**, **Mã đơn**, **Số hóa đơn**.",
          "Gán thêm **Dư đầu kỳ**, **Phát sinh (hóa đơn)**, **Đã thu**, **Hoàn trả** nếu bảng có các cột này.",
          "Nhập **Kỳ báo cáo từ ngày** và **đến ngày**.",
          "Chọn **Tiền tệ khi ô không ghi** đúng loại tiền của bảng.",
          "Bấm **Chạy kiểm tra**.",
          "Bấm **Chi tiết** ở các dòng **Lệch** để xem phần **Hệ thống** (**Đã xuất hóa đơn**, **Đã thu**, **Còn phải thu**, **Trả trước**…).",
        ],
        result:
          "Bạn thấy khách nào có dư nợ khác với hệ thống và khách nào có trong hệ thống nhưng thiếu trên bảng.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        title: "Sửa cột khi chạy không được",
        when: "Bấm **Chạy kiểm tra** thì trang báo “Cách chọn cột chưa chạy được.”",
        steps: [
          "Đọc các dòng dưới chữ “Chưa chạy được vì:” trong khung đỏ.",
          "Gán ý nghĩa cho cột còn thiếu nếu trang báo “Thiếu cột bắt buộc cho loại bảng này”.",
          "Đổi một trong hai cột sang ý nghĩa khác nếu trang báo “Hai cột đang cùng một ý nghĩa”.",
          "Chọn **Định dạng ngày** cho cột ngày nếu trang báo cột ngày mâu thuẫn.",
          "Bấm **Chạy kiểm tra** lại.",
        ],
        result: "Bản kiểm tra chạy xong và đổi sang **Đã kiểm tra**.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        title: "Chạy lại một bảng đã kiểm tra",
        when: "Bạn đã sửa số liệu trong phần mềm, hoặc muốn chọn cột khác cho cùng một tệp.",
        steps: [
          "Mở bản kiểm tra **Đã kiểm tra**.",
          "Bấm **Chạy lại với tệp này**.",
          "Kiểm tra lại cột trên phần **Xác nhận cột** vừa mở.",
          "Bấm **Chạy kiểm tra**.",
        ],
        result:
          "Trang báo “Đã tạo bản kiểm tra mới từ tệp cũ. Xác nhận cột rồi chạy lại.”. Bản mới có liên kết **Chạy lại từ bản …** trỏ về bản cũ; kết quả cũ vẫn giữ nguyên.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        title: "Hủy bản nháp tải nhầm",
        when: "Bạn tải nhầm tệp hoặc chọn nhầm loại bảng và chưa chạy.",
        steps: [
          "Mở bản kiểm tra đang **Chờ chọn cột**.",
          "Kéo xuống cuối trang.",
          "Bấm **Hủy bản nháp**.",
        ],
        result:
          "Trang quay về danh sách và báo “Đã hủy bản nháp.”. Bản đã chạy thì không hủy được.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        title: "Xem và xuất kết quả kiểm tra",
        when: "Có người đã chạy kiểm tra và bạn cần xem hoặc gửi kết quả.",
        steps: [
          "Bấm **Đã kiểm tra** ở hàng lọc **Trạng thái**.",
          "Bấm tên tệp hoặc **Mở →** ở bản cần xem.",
          "Xem **Tổng quan** và **Tổng cộng theo cột**.",
          "Xem **Từng dòng**; bấm **Tất cả dòng** nếu muốn xem cả dòng không có lỗi.",
          "Bấm **Xuất CSV** để tải kết quả về máy.",
        ],
        result: "Tệp CSV được tải về máy; bản kiểm tra không thay đổi.",
      },
    ],
    terms: [
      {
        term: "Excel / CSV / .xlsx / .xls / .csv",
        meaning:
          "Excel là phần mềm bảng tính; .xlsx và .xls là tệp Excel; CSV (.csv) là tệp bảng dạng chữ, mở được bằng Excel. “CSV UTF-8” là một kiểu lưu CSV có trong mục Lưu dưới dạng của Excel.",
      },
      {
        term: "Sheet",
        meaning: "Một trang tính (một tab) trong tệp Excel.",
      },
      {
        term: "Macro",
        meaning:
          "Đoạn lệnh tự chạy gắn trong tệp Excel (thường là tệp .xlsm). Tệp có macro bị từ chối để an toàn.",
      },
      {
        term: "Báo cáo tiền về",
        meaning:
          "Loại bảng mà mỗi dòng là một khoản khách chuyển tiền; được so với phiếu thu của khách.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        term: "Báo cáo công nợ / dư nợ",
        meaning:
          "Loại bảng mà mỗi dòng là một khách, hóa đơn hoặc đơn với dư nợ cuối kỳ; được so với công nợ trong hệ thống.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        term: "Danh sách đơn hàng",
        meaning:
          "Loại bảng bất kỳ có cột mã đơn; được so với đơn hàng trong phần mềm.",
      },
      {
        term: "Chờ chọn cột",
        meaning:
          "Trạng thái nhãn vàng: bảng đã đọc nhưng chưa chạy. Bản nháp tự xóa vào ngày ghi ở **Bản nháp tự xóa vào**.",
      },
      {
        term: "Đã kiểm tra",
        meaning:
          "Trạng thái nhãn xanh: đã chạy xong, kết quả không thay đổi được nữa.",
      },
      {
        term: "Lỗi / cảnh báo",
        meaning:
          "Cột trong danh sách: số bên trái là số lỗi (đỏ), số bên phải là số cảnh báo (vàng). Dấu “—” nghĩa là chưa chạy.",
      },
      {
        term: "Ý nghĩa",
        meaning:
          "Cột trên phần **Xác nhận cột** cho biết mỗi cột của bảng chứa gì (**Mã đơn**, **Ngày**, **Số tiền**…). Chọn **Bỏ qua** cho cột không cần so.",
      },
      {
        term: "chắc / khá chắc / đoán",
        meaning:
          "Mức tự tin khi hệ thống tự đoán ý nghĩa của cột. Cột ghi “đoán” cần kiểm tra kỹ.",
      },
      {
        term: "Đơn vị",
        meaning:
          "**Đơn vị gốc** là số ghi sao để vậy; **× 1.000** khi bảng ghi theo nghìn; **× 1.000.000** khi bảng ghi theo triệu. Chữ “tiêu đề gợi ý đơn vị” nghĩa là tiêu đề cột có nhắc tới nghìn hoặc triệu.",
      },
      {
        term: "Kiểu số",
        meaning:
          "Cách viết số: **1.250.000,50** (kiểu Việt Nam) hoặc **1,250,000.50** (kiểu Anh). **Tự nhận** để hệ thống tự đoán.",
      },
      {
        term: "Kỳ báo cáo",
        meaning:
          "Khoảng ngày của bảng. Dùng để thêm năm cho ngày thiếu năm, lọc phiếu thu, hóa đơn và tính dư đầu kỳ.",
      },
      {
        term: "Khớp / Lệch / Không thấy",
        meaning:
          "Kết quả của một dòng: **Khớp** là trùng với hệ thống; **Lệch** là tìm thấy nhưng khác số liệu; **Không thấy** là không tìm thấy trong hệ thống.",
      },
      {
        term: "Không đối chiếu / Không đọc được / Bỏ qua",
        meaning:
          "**Không đối chiếu** là dòng không được so; **Không đọc được** là ô sai định dạng; **Bỏ qua** là dòng không phải dữ liệu (dòng tổng, dòng trống…).",
      },
      {
        term: "Lỗi / Cảnh báo / Thông tin",
        meaning:
          "Mức của một phát hiện: **Lỗi** là sai hoặc không khớp; **Cảnh báo** là cần xem lại; **Thông tin** chỉ để biết.",
      },
      {
        term: "Dữ liệu / Tổng / Tổng phụ / Nhóm / Trống",
        meaning:
          "Cột **Loại** trong **Từng dòng**: dòng dữ liệu thật, dòng tổng, dòng tổng phụ, dòng tiêu đề nhóm hoặc dòng trống. **dòng ẩn** là dòng bị ẩn trong Excel.",
      },
      {
        term: "Tổng cộng theo cột",
        meaning:
          "**Cộng từ các dòng** là tổng hệ thống tự cộng; **Dòng tổng trong bảng** là số ghi ở dòng tổng (hiện đỏ nếu khác); **Dòng tính / bỏ qua** là số dòng được cộng và bị bỏ. Mỗi loại tiền tính riêng.",
      },
      {
        term: "Hệ thống",
        meaning:
          "Cột trong **Tổng cộng theo cột** và phần trong **Chi tiết** của một dòng: số liệu phần mềm đang giữ để so. Cột này chỉ hiện khi bản kiểm tra được phép so tiền.",
      },
      {
        term: "Có trong hệ thống nhưng không có trong bảng",
        meaning:
          "Phiếu thu, hóa đơn hoặc khách có trong phần mềm mà bảng không ghi.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        term: "Quyền cần có để xem",
        meaning:
          "Dòng ghi tên kỹ thuật các quyền mà người xem bản kiểm tra này phải có. Bạn không cần làm gì với dòng này.",
      },
      {
        term: "VND / USD",
        meaning:
          "VND là đồng Việt Nam, USD là đô la Mỹ. Không bao giờ cộng gộp hai loại tiền.",
      },
    ],
    tips: [
      {
        text: "Chọn đúng **Loại bảng** ngay từ đầu: loại bảng quyết định bảng được so với gì. Chọn nhầm thì bấm **Hủy bản nháp** rồi tải lại.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Luôn xem lại cột **Ý nghĩa** trước khi bấm **Chạy kiểm tra**, nhất là cột có chữ “đoán”, cột báo “lẫn hai kiểu — hãy chọn” ở **Kiểu số** và cột báo “mâu thuẫn — hãy chọn” ở **Định dạng ngày**.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Nếu **Dòng tiêu đề** ghi “không nhận ra — hãy chọn cột thủ công”, bạn phải tự chọn **Ý nghĩa** cho từng cột.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Nút **Hủy bản nháp** hiện cả với bản nháp do người khác tải. Chỉ hủy bản của mình, trừ khi đã thống nhất với người tải.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Tệp tối đa 4 MB, 2.000 dòng dữ liệu, 40 cột, 10 sheet. Bảng dài hơn thì tách theo tháng.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Ô có công thức chỉ được đọc giá trị đã lưu. Mở tệp bằng Excel và lưu lại trước khi tải để số liệu mới nhất được lưu trong tệp.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Mặc định **Từng dòng** chỉ hiện dòng **Có cảnh báo / lỗi**. Bấm **Tất cả dòng** để xem cả dòng đã khớp.",
      },
      {
        text: "Kết quả là ảnh chụp dữ liệu tại thời điểm ghi ở **Dữ liệu hệ thống lấy lúc**. Sau khi sửa số liệu trong phần mềm, bấm **Chạy lại với tệp này** để so lại.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Nếu **Phát hiện chung** có cảnh báo “Chỉ nạp được … bản ghi … mới nhất từ hệ thống”, hệ thống chỉ so được với phần dữ liệu mới nhất. Dòng **Không thấy** khi đó chưa chắc là thiếu thật; hãy kiểm tra lại dòng đó trên trang nghiệp vụ.",
      },
      {
        text: "Bản **Danh sách đơn hàng** bạn chạy sẽ không hiện với Thủ kho, Quản lý nhà máy và Kế toán nhà máy nếu bảng có cột **Số hóa đơn** hoặc cột tên, mã khách, hoặc bạn đánh dấu so giá bán. Nếu họ cần xem, hãy để Thủ kho hoặc Kế toán nhà máy tự tải bảng.",
        roles: ["COMPANY_ACCOUNTANT"],
      },
      {
        text: "Thông báo xanh: “Đã chạy kiểm tra. Kết quả bên dưới không thay đổi được nữa.”, “Đã hủy bản nháp.”, “Đã tạo bản kiểm tra mới từ tệp cũ. Xác nhận cột rồi chạy lại.”.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Lỗi khi tải tệp (khung đỏ “Thao tác không thành công:”): “Tệp vượt 4 MB.”; “Chỉ nhận .xlsx, .xls, .csv; không nhận tệp có macro hoặc tệp đổi đuôi.”; “Tệp chứa macro; mở bằng Excel, Lưu dưới dạng .xlsx rồi tải lại.”; “Tệp nén bất thường, bị từ chối.”; “Không có sheet nào có dữ liệu.”; “Tối đa 2.000 dòng dữ liệu; hãy tách tệp theo tháng.”; “Không đọc được tệp.”; “Không tìm thấy sheet có số thứ tự hoặc tên đã nhập.”.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Lỗi với tệp CSV: “Không đọc được bảng mã; lưu lại dạng CSV UTF-8.” (mở bằng Excel, chọn Lưu dưới dạng CSV UTF-8); “Tệp CSV có dấu nháy chưa đóng.” kèm số dòng bị lỗi.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "“Bạn tải lên quá nhiều trong 10 phút; đợi một lát rồi thử lại.”: mỗi người tải tối đa 10 lần trong 10 phút.",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "Lỗi khi chạy hoặc hủy: “Bản kiểm tra này đã chạy rồi.”; “Bản kiểm tra đã chạy; không hủy được nữa.”; “Bản kiểm tra đã thay đổi trong lúc bạn thao tác. Trang đã tải lại — kiểm tra rồi thử lại.”; “Không tìm thấy bản kiểm tra.” (bản đã bị hủy hoặc đã tự xóa).",
        roles: [
          "WAREHOUSE_MANAGER",
          "FACTORY_ACCOUNTANT",
          "COMPANY_ACCOUNTANT",
        ],
      },
      {
        text: "“Bạn không có quyền thực hiện thao tác này.” nghĩa là việc đó không thuộc phần của bạn; “Hệ thống tạm thời không phản hồi.”: đợi một lát rồi thử lại.",
      },
      {
        text: "Nếu bấm vào một liên kết bản kiểm tra mà trang báo không tìm thấy, có thể bản đó có đối chiếu tiền mà bạn không được xem, hoặc đã tự xóa.",
        roles: ["WAREHOUSE_MANAGER", "FACTORY_MANAGER", "FACTORY_ACCOUNTANT"],
      },
    ],
  },
];
