import type { ScreenGuide } from "../guide-types";

/**
 * Thủ kho: Bảng xuất kho sơn and Nguyên vật liệu. Both screens are held only
 * by the storekeeper's menu, so no entry is narrowed by role.
 */
export const warehouseScreens: readonly ScreenGuide[] = [
  {
    path: "/paint-warehouse",
    title: "Bảng xuất kho sơn",
    summary:
      "Sổ chi tiết xuất kho sơn năm 2026, thay cho việc gõ tay sheet ChiTietxuatkho trong file Excel. Mỗi dòng là một lần xuất sơn cho một cơ sở sản xuất; tên cơ sở, tên vật tư, đơn vị tính, đơn giá và thành tiền tự tính từ danh mục.",
    layout: [
      {
        text: "Đầu trang: tiêu đề **Bảng xuất kho sơn** và một dòng tóm tắt gồm số dòng khớp bộ lọc, **Thành tiền thực nhận** cộng trên toàn bộ các dòng khớp bộ lọc (không chỉ phần đang hiện), và trạng thái tải/lưu. Khi phiếu đang sửa chưa áp dụng, dòng này có thêm chữ “Có thay đổi chưa áp dụng.”",
      },
      {
        text: "Thẻ công cụ: ô **Tìm**, ô **Từ ngày**, ô **Đến ngày**, nút **Lọc** và **Xóa bộ lọc**; bên dưới là các nút **+ Thêm phiếu xuất**, **Dán từ Excel**, **Nhập Excel**, **Xuất Excel**, **Tải lại** và dòng “Hiển thị x/y dòng”.",
      },
      {
        text: "Khu thông báo: khung đỏ báo lỗi (khi lưu bị từ chối có thêm nút **Thử lưu lại** và **Tải bản nháp**), khung xanh báo đã làm xong, và các khung xác nhận ngay trong trang khi xóa dòng hoặc bỏ phiếu đang sửa.",
      },
      {
        text: "Các thẻ chỉ hiện khi bạn mở: thẻ vàng xem trước file Excel, thẻ **Dán từ Excel**, và form **Thêm phiếu xuất** / **Sửa phiếu xuất**.",
      },
      {
        text: "Bảng sổ có 14 cột theo đúng thứ tự file Excel: **Ngày**, **Mã cơ sở**, **Cơ sở SX**, **Mã vật tư**, **Vật tư**, **Diễn giải**, **ĐVT**, **Số lượng**, **Đơn giá**, **Thành tiền**, **SL thực nhận**, **Đơn giá đã chiết khấu** (nền vàng nhạt), **Thành tiền thực nhận**, **Ghi chú**. Cột **Thao tác** luôn dính ở mép phải, có nút **Sửa** và **Xóa dòng**.",
      },
      {
        text: "Bảng xếp theo ngày từ cũ đến mới và tải 200 dòng mỗi lần; các ngày mới nhất nằm ở cuối. Dưới bảng có nút **Tải thêm (n dòng còn lại)** khi sổ còn dòng chưa hiện.",
      },
    ],
    capabilities: [
      {
        text: "Tìm theo mã hoặc tên vật tư, mã hoặc tên cơ sở SX, ghi chú; lọc theo khoảng ngày **Từ ngày** – **Đến ngày**. Bộ lọc chỉ chạy khi bấm **Lọc** (hoặc Enter trong ô lọc).",
      },
      {
        text: "Thêm một phiếu xuất bằng **+ Thêm phiếu xuất**: gõ mã hoặc tên cơ sở và vật tư, nhập số lượng; tên cơ sở, tên vật tư, ĐVT, đơn giá và thành tiền tự điền.",
      },
      {
        text: "Nhập riêng số lượng thực nhận hoặc đơn giá đã chiết khấu cho từng dòng; để trống thì hệ thống lấy theo **Số lượng** và **Đơn giá** của dòng.",
      },
      {
        text: "Sửa mọi dòng đã ghi bằng nút **Sửa**; xóa dòng bằng **Xóa dòng** sau khi xác nhận. Bấm **Hủy** trong form để đóng form mà không ghi.",
      },
      {
        text: "Dán nhiều dòng một lúc (tối đa 500 dòng) bằng **Dán từ Excel**, xem kết quả kiểm tra từng dòng rồi ghi một lần.",
      },
      {
        text: "Nhập cả file Excel sổ xuất kho sơn (.xlsx hoặc .xlsm, tối đa 5 MB) bằng **Nhập Excel**: xem số dòng theo từng trạng thái của cả file và bảng 200 dòng đầu, chọn có nhập dòng trùng hay không, rồi mới ghi.",
      },
      {
        text: "Tải file **BANG-XUAT-KHO-SON.xlsx** bằng **Xuất Excel**. File trình bày theo mẫu sổ Excel gốc và chỉ gồm các dòng khớp bộ lọc đã bấm **Lọc**.",
      },
      {
        text: "Khi lưu bị từ chối, bấm **Thử lưu lại** để gửi lại đúng các dòng đó, hoặc **Tải bản nháp** để tải về máy một tệp ghi lại nội dung vừa gửi (tệp này chỉ để đối chiếu, không nhập lại vào màn hình được).",
      },
      {
        text: "Bấm **Tải lại** để lấy số liệu mới nhất (ví dụ khi đồng nghiệp cũng đang ghi sổ).",
      },
    ],
    limits: [
      {
        text: "Không sửa được danh mục cơ sở SX, danh mục vật tư sơn hay đơn giá gốc trên màn hình này, và trên web cũng chưa có chỗ sửa danh mục này. Cả form, dán và nhập file đều không thêm mã mới vào danh mục.",
      },
      {
        text: "Không gõ tay được các ô **Tên cơ sở SX**, **Vật tư**, **ĐVT**, **Đơn giá**, **Thành tiền**, **Thành tiền thực nhận** trong form; chúng luôn tự tính.",
      },
      {
        text: "Form và **Dán từ Excel** không nhận mã cơ sở hoặc mã vật tư không có trong danh mục. Chỉ **Nhập Excel** mới nhận mã lạ (giữ nguyên tên và số liệu ghi trong file).",
      },
      {
        text: "Dòng đã xóa không còn trong bảng và trong file Excel xuất ra; màn hình không có nút khôi phục.",
      },
      {
        text: "Màn hình này chỉ là sổ xuất. Trên web chưa có sổ nhập sơn hay bảng tồn kho sơn, nên ở đây không xem được tồn kho sơn.",
      },
    ],
    flows: [
      {
        title: "Ghi một phiếu xuất sơn",
        when: "Mỗi lần xuất sơn cho một cơ sở sản xuất.",
        steps: [
          "Bấm **+ Thêm phiếu xuất**.",
          "Kiểm tra **Ngày xuất** (mặc định là hôm nay), chọn lại nếu cần.",
          "Gõ mã hoặc tên cơ sở vào ô **Mã cơ sở SX**, chọn từ danh sách gợi ý; ô **Tên cơ sở SX** tự điền.",
          "Gõ mã hoặc tên vào ô **Mã vật tư**; dòng gợi ý bên dưới hiện tên vật tư và ĐVT.",
          "Kiểm tra ô **Diễn giải** (mặc định “xuất kho”).",
          "Nhập **Số lượng**, dùng dấu chấm cho số thập phân (ví dụ 0.3).",
          "Nếu thực nhận khác số lượng, nhập **Số lượng thực nhận**; nếu có chiết khấu, nhập **Đơn giá đã chiết khấu**. Không có thì để trống.",
          "Kiểm tra các ô tự tính **Đơn giá**, **Thành tiền**, **Thành tiền thực nhận**.",
          "Nhập **Ghi chú** nếu cần.",
          "Bấm **Áp dụng**.",
        ],
        result:
          "Dòng được ghi vào sổ ngay, form đóng lại, khung xanh báo “Đã ghi dòng …” và bảng tải lại. Không cần ai duyệt, không có thông báo gửi đi.",
      },
      {
        title: "Sửa một dòng đã ghi",
        when: "Ghi nhầm số lượng, mã, ngày hoặc cần thêm chiết khấu.",
        steps: [
          "Tìm dòng bằng ô **Tìm** hoặc **Từ ngày** / **Đến ngày**, rồi bấm **Lọc**.",
          "Bấm **Sửa** ở cột **Thao tác** của dòng đó.",
          "Sửa các ô cần đổi trong form **Sửa phiếu xuất**.",
          "Muốn quay về giá trị mặc định cho **Số lượng thực nhận** hoặc **Đơn giá đã chiết khấu**, xóa trắng ô đó.",
          "Bấm **Áp dụng**.",
        ],
        result:
          "Dòng được cập nhật ngay, khung xanh báo “Đã cập nhật dòng …”. Đơn giá của dòng chỉ lấy lại từ danh mục khi bạn đổi mã vật tư (hoặc khi dòng chưa có đơn giá).",
      },
      {
        title: "Xóa một dòng ghi nhầm",
        steps: [
          "Bấm **Xóa dòng** ở cột **Thao tác**.",
          "Đọc lại ngày, vật tư, cơ sở và số lượng trong khung xác nhận hiện phía trên bảng.",
          "Bấm **Xóa dòng** trong khung để xóa, hoặc **Giữ lại** để thôi.",
        ],
        result:
          "Dòng biến mất khỏi bảng và khỏi file Excel xuất ra; khung xanh báo “Đã xóa dòng …”.",
      },
      {
        title: "Dán nhiều dòng từ Excel",
        when: "Có sẵn nhiều dòng xuất trong một file Excel khác.",
        steps: [
          "Trong Excel, sắp các cột theo thứ tự: Ngày, Mã cơ sở, Mã vật tư, Số lượng, SL thực nhận, Đơn giá đã chiết khấu, Ghi chú. Ngày ghi dạng ngày/tháng/năm (ví dụ 05/03/2026); ngày trống lấy hôm nay; ba cột cuối có thể để trống.",
          "Chọn các dòng đó trong Excel và sao chép.",
          "Bấm **Dán từ Excel** trên màn hình.",
          "Dán vào ô **Các dòng từ Excel**.",
          "Bấm **Đọc dữ liệu**.",
          "Xem cột **Kết quả**: dòng **Hợp lệ** sẽ được ghi, dòng **Lỗi** có ghi lý do và sẽ không được ghi.",
          "Sửa dòng lỗi trong ô dán rồi bấm **Đọc dữ liệu** lại, nếu cần.",
          "Bấm **Ghi N dòng**.",
        ],
        result:
          "Các dòng hợp lệ được ghi cùng lúc, thẻ dán đóng lại và khung xanh báo “Đã ghi N dòng từ dữ liệu dán.” Diễn giải của các dòng dán luôn là “xuất kho”. Nếu lúc lưu bị từ chối thì cả lô không được ghi; nội dung dán vẫn còn để bạn sửa.",
      },
      {
        title: "Nhập cả file Excel sổ xuất kho sơn",
        when: "Chuyển dữ liệu từ file Excel sổ xuất kho sơn lên web.",
        steps: [
          "Bấm **Nhập Excel** và chọn file .xlsx hoặc .xlsm (tối đa 5 MB). File phải có đủ các sheet ChiTietxuatkho, Cososx và Kho son.",
          "Đọc thẻ vàng “Đang xem trước file … — chưa ghi vào sổ”: số dòng **Hợp lệ**, **Trùng**, **Đã nhập**, **Lỗi**, thành tiền theo file và thành tiền thực nhận.",
          "Bấm **Xem N ghi chú khi đọc file** để đọc các lỗi và cảnh báo, nếu có.",
          "Xem cột **Trạng thái** và **Ghi chú** của từng dòng; bảng chỉ hiện 200 dòng đầu, dấu * cạnh mã là mã chưa có trong danh mục.",
          "Chỉ tích **Nhập cả các dòng trùng** khi chắc chắn các dòng trùng là lần xuất khác thật.",
          "Bấm **Nhập N dòng vào sổ**, hoặc **Hủy nhập file** nếu chọn nhầm file.",
        ],
        result:
          "Khung xanh báo “Đã nhập N dòng từ <tên file>; bỏ qua M dòng đã có.” và bảng tải lại. Dòng nhập từ file giữ nguyên tên, đơn giá và thành tiền ghi trong file. Trước khi bấm nhập, không có gì được ghi vào sổ.",
      },
      {
        title: "Xuất file Excel để đối chiếu hoặc gửi đi",
        steps: [
          "Đặt bộ lọc cần thiết (**Tìm**, **Từ ngày**, **Đến ngày**) rồi bấm **Lọc**. Muốn lấy cả sổ thì bấm **Xóa bộ lọc**.",
          "Bấm **Xuất Excel**.",
          "Mở file **BANG-XUAT-KHO-SON.xlsx** vừa tải về.",
        ],
        result:
          "File có đúng các dòng khớp bộ lọc, xếp theo ngày, trình bày theo mẫu sổ Excel gốc.",
      },
      {
        title: "Xử lý khi lưu bị từ chối",
        when: "Khung đỏ hiện sau khi bấm **Áp dụng** hoặc **Ghi N dòng**.",
        steps: [
          "Đọc nội dung khung đỏ.",
          "Bấm **Tải bản nháp** nếu muốn giữ lại nội dung vừa gửi trên máy để đối chiếu.",
          "Nếu khung đỏ báo “Dữ liệu đã được người khác thay đổi…”, đừng bấm **Thử lưu lại** (sẽ bị từ chối lần nữa). Bấm **Hủy** trong form, rồi bấm **Bỏ thay đổi và tiếp tục**.",
          "Tìm lại dòng đó trong bảng vừa tự tải lại, kiểm tra số liệu người khác đã sửa, rồi bấm **Sửa** và nhập lại thay đổi của bạn nếu vẫn cần.",
          "Nếu khung đỏ báo “Không thể lưu/đọc dữ liệu kho lúc này…”, đợi một lát rồi bấm **Thử lưu lại**.",
        ],
        result: "Khi lưu lại được, khung xanh báo “Đã lưu lại N dòng.”",
      },
    ],
    terms: [
      {
        term: "Mã cơ sở / Cơ sở SX",
        meaning:
          "Mã và tên cơ sở sản xuất nhận sơn, lấy từ danh mục cơ sở. SX là viết tắt của sản xuất.",
      },
      {
        term: "ĐVT",
        meaning: "Đơn vị tính của vật tư (kg, lít…), tự lấy từ danh mục.",
      },
      {
        term: "Đơn giá / Thành tiền",
        meaning:
          "Đơn giá lấy từ danh mục vật tư tại lúc ghi dòng (dòng nhập từ file giữ đơn giá trong file). Thành tiền = Số lượng × Đơn giá. Sửa danh mục về sau không làm đổi đơn giá của các dòng đã ghi.",
      },
      {
        term: "SL thực nhận",
        meaning:
          "Số lượng cơ sở thực nhận. Để trống thì bằng **Số lượng**; gõ số khác thì giữ số bạn gõ.",
      },
      {
        term: "Đơn giá đã chiết khấu",
        meaning:
          "Đơn giá sau chiết khấu, ô nền vàng, có thể sửa tay cho từng dòng. Để trống thì bằng **Đơn giá** của dòng.",
      },
      {
        term: "Thành tiền thực nhận",
        meaning:
          "SL thực nhận × Đơn giá đã chiết khấu. Con số ở đầu trang là tổng cột này trên mọi dòng khớp bộ lọc.",
      },
      {
        term: "Hợp lệ",
        meaning: "Dòng đọc được và sẽ được ghi (khi dán hoặc nhập file).",
      },
      {
        term: "Trùng",
        meaning:
          "Khi nhập file: dòng giống hệt một dòng đã có trong sổ (cùng ngày, mã vật tư, mã cơ sở, số lượng, ghi chú). Chỉ được ghi khi tích **Nhập cả các dòng trùng**.",
      },
      {
        term: "Đã nhập",
        meaning:
          "Khi nhập file: dòng này đã được nhập từ đúng file đó trước đây, sẽ bị bỏ qua để không tạo bản sao.",
      },
      {
        term: "Lỗi",
        meaning:
          "Dòng không đọc được, thiếu dữ liệu hoặc số liệu không khớp; lý do ghi ngay cạnh (cột **Kết quả** khi dán, cột **Ghi chú** khi nhập file). Dòng lỗi không được ghi.",
      },
      {
        term: "Dấu * cạnh mã",
        meaning:
          "Trong bảng xem trước file: mã cơ sở hoặc mã vật tư chưa có trong danh mục. Dòng vẫn nhập được và giữ nguyên tên ghi trong file.",
      },
      {
        term: "Excel, .xlsx, .xlsm",
        meaning:
          "Excel là phần mềm bảng tính; .xlsx và .xlsm là đuôi của file Excel mà màn hình này nhận.",
      },
      {
        term: "Sheet",
        meaning:
          "Một trang tính bên trong file Excel (các thẻ tên ở đáy cửa sổ Excel), ví dụ ChiTietxuatkho, Cososx, Kho son.",
      },
    ],
    tips: [
      {
        text: "Số thập phân dùng dấu chấm (0.3), dấu phẩy chỉ để phân cách hàng nghìn. Gõ 0,3 sẽ bị báo đỏ “Dùng dấu chấm cho số thập phân (ví dụ 0.3); dấu phẩy phân cách hàng nghìn.”",
      },
      {
        text: "Nhìn dòng gợi ý dưới ô mã: nếu thấy “Không có trong danh mục” thì mã gõ sai; bấm **Áp dụng** sẽ báo “Mã cơ sở SX không có trong danh mục.” hoặc “Mã vật tư không có trong danh mục.”",
      },
      {
        text: "“Chưa chọn mã vật tư.” và “Chưa nhập số lượng.” hiện dưới ô tương ứng khi bạn bấm **Áp dụng** mà còn thiếu. Ô **Mã cơ sở SX** không bị bắt buộc, nên hãy tự kiểm tra đã điền cơ sở trước khi bấm **Áp dụng**.",
      },
      {
        text: "Khung đỏ “Dữ liệu đã được người khác thay đổi. Bản nháp của bạn vẫn được giữ; tải lại để đối chiếu.” nghĩa là có người vừa sửa hoặc xóa cùng dòng đó; bảng tự tải lại, bạn kiểm tra rồi sửa lại nếu cần. Khi xóa mà gặp “Dòng đã thay đổi hoặc đã bị xóa; hãy tải lại.” thì bấm **Tải lại** rồi kiểm tra dòng đó.",
      },
      {
        text: "Khi đang sửa dở mà bấm việc khác (lọc, tải lại, dán, sửa hoặc xóa dòng khác, **Hủy**…), khung “Phiếu đang sửa có thay đổi chưa áp dụng. Tiếp tục sẽ bỏ những thay đổi đó.” hiện ra: bấm **Bỏ thay đổi và tiếp tục** để bỏ, hoặc **Quay lại chỉnh sửa** để giữ. Đóng hay tải lại trang lúc này, trình duyệt cũng hỏi lại.",
      },
      {
        text: "Lỗi khi chọn file: “Chỉ nhận file Excel .xlsx hoặc .xlsm.”, “File vượt quá 5 MB. Hãy tách bớt dòng rồi nhập lại.”, “Không đọc được tệp Excel. Cần đủ các sheet ChiTietxuatkho, Cososx và Kho son.” Nếu mọi dòng đều lỗi, đã nhập hoặc trùng (chưa tích nhập dòng trùng), nút hiện **Nhập 0 dòng vào sổ** và không bấm được.",
      },
      {
        text: "Dán quá 500 dòng sẽ báo “Dán tối đa 500 dòng mỗi lần.” Hãy chia thành nhiều lần dán.",
      },
      {
        text: "“Không thể lưu/đọc dữ liệu kho lúc này. Giữ bản nháp và thử lại.” là lỗi tạm thời: đợi một lát rồi bấm **Thử lưu lại**. “Bạn không có quyền thao tác bảng xuất kho sơn.” thường do phiên đăng nhập đã hết; hãy đăng nhập lại.",
      },
      {
        text: "Thói quen tốt: sau khi nhập file hoặc dán nhiều dòng, lọc đúng khoảng ngày rồi so con số **Thành tiền thực nhận** ở đầu trang với tổng trên file gốc.",
      },
    ],
  },
  {
    path: "/materials",
    title: "Nguyên vật liệu",
    summary:
      "Kho nguyên vật liệu (NVL) năm 2026, thay cho file “RedDoor - NVL - 2026.xlsx”. Bạn ghi phiếu nhập, phiếu xuất, quản lý danh mục vật tư và cơ sở nhận hàng; tồn kho tự tính theo công thức Tồn cuối = Tồn đầu + Nhập − Xuất.",
    layout: [
      {
        text: "Đầu trang: tiêu đề **Nguyên vật liệu** và dòng tóm tắt “Kho nguyên vật liệu 2026 · số vật tư đang theo dõi · số giao dịch · Cập nhật gần nhất … bởi …”.",
      },
      {
        text: "Thanh công cụ: bốn nút tab **Tổng kho**, **Nhập kho**, **Xuất kho**, **Danh mục NVL**; bên phải là **Nhập Excel**, **Dán từ Excel**, **Xuất Excel**, **In báo cáo**.",
      },
      {
        text: "Tab **Tổng kho**: vòng biểu đồ và bốn ô **Còn hàng**, **Sắp hết**, **Hết hàng**, **Ngừng dùng** (số lượng và tỉ lệ %); bộ lọc; bảng **STT**, **Mã vật tư**, **Vật tư**, **ĐVT**, **Tồn đầu**, **Nhập**, **Xuất**, **Tồn cuối**, **Trạng thái**, **Ghi chú**. Bấm mã hoặc tên vật tư mở thẻ chi tiết vật tư phía trên bộ lọc.",
      },
      {
        text: "Tab **Nhập kho**: bộ lọc, nút **Thêm phiếu nhập**, bảng **Ngày**, **Mã vật tư**, **Vật tư**, **Diễn giải**, **ĐVT**, **Số lượng**, **Đơn giá**, **Thành tiền**, **Ghi chú**, **Người ghi**, **Ghi lúc** và cột **Thao tác** (**Sửa**, **Hủy dòng**).",
      },
      {
        text: "Tab **Xuất kho**: như tab nhập nhưng nút là **Thêm phiếu xuất**, bảng có thêm **Mã cơ sở** và **Cơ sở / người nhận**, không có **Đơn giá** và **Thành tiền**. Hai tab sổ xếp ngày mới nhất lên đầu, tải 200 dòng mỗi lần với nút **Tải thêm (n dòng còn lại)**.",
      },
      {
        text: "Tab **Danh mục NVL**: thẻ **Danh mục vật tư (KhoNVL)** (cột **STT**, **Mã**, **Tên**, **ĐVT**, **Tồn đầu kỳ**, **Tồn tối thiểu**, **Ghi chú**, **Trạng thái**) và thẻ **Cơ sở / người nhận (Cososx)** (cột **STT**, **Loại**, **Mã**, **Tên**, **SĐT**, **Ghi chú**, **Trạng thái**). Mỗi thẻ có ô tìm, nút thêm và cột **Thao tác** (**Sửa**, **Ngừng dùng** hoặc **Dùng lại**).",
      },
      {
        text: "Cuối trang: thẻ có **Xuất Excel**, **In báo cáo**, **Lịch sử chỉnh sửa**. Bấm **Lịch sử chỉnh sửa** mở bảng **Thời gian**, **Người thực hiện**, **Thao tác**, **Chi tiết** của toàn kho.",
      },
      {
        text: "Khung đỏ báo lỗi, khung xanh báo đã xong, khung vàng xem trước file Excel, thẻ **Dán từ Excel** và các khung xác nhận (hủy dòng, ngừng dùng, bỏ thay đổi, hủy nhập file) hiện ngay dưới thanh công cụ.",
      },
    ],
    capabilities: [
      {
        text: "Xem tồn kho từng vật tư ở **Tổng kho**; lọc ngay khi gõ hoặc chọn bằng **Tìm vật tư**, **ĐVT**, **Trạng thái**; tích **Hiện toàn bộ danh mục** để thấy cả mã chưa từng có tồn, giao dịch hay đã ngừng dùng; bấm **Xóa bộ lọc** để về mặc định.",
      },
      {
        text: "Bấm số ở cột **Nhập** hoặc **Xuất** để mở sổ nhập / sổ xuất đã lọc sẵn theo vật tư đó (hiện chip **Vật tư: mã**; bấm ✕ trên chip để bỏ lọc, nút **Xóa bộ lọc** không bỏ chip này).",
      },
      {
        text: "Mở thẻ chi tiết vật tư: tồn hiện tại kèm trạng thái, **Tồn đầu**, **Σ nhập**, **Σ xuất**, **Tồn tối thiểu**, **Ghi chú**, bảng **Giao dịch** (chỉ phiếu chưa hủy, có cột **Tồn sau**, nút **Tải thêm**) và phần **Lịch sử thay đổi**; bấm **Nhập kho** / **Xuất kho** trong thẻ để mở form phiếu đã điền sẵn vật tư.",
      },
      {
        text: "Ghi phiếu nhập (có thể kèm đơn giá, thành tiền tự tính) và phiếu xuất cho một cơ sở / người nhận. Phiếu xuất hiện **Tồn hiện tại** và báo ngay nếu xuất vượt tồn.",
      },
      {
        text: "Sửa phiếu đã ghi bằng **Sửa**; hủy phiếu bằng **Hủy dòng** kèm lý do. Tích **Hiện dòng đã hủy** để xem lại các dòng đã hủy.",
      },
      {
        text: "Lọc sổ nhập / sổ xuất theo **Từ ngày**, **Đến ngày** và ô **Tìm** (mã, tên vật tư, cơ sở, ghi chú, diễn giải). Bộ lọc tự chạy, không cần bấm nút.",
      },
      {
        text: "Thêm, sửa vật tư (mã, tên, ĐVT, tồn đầu kỳ, tồn tối thiểu, ghi chú) và cơ sở / người nhận (mã, tên, loại, SĐT, ghi chú); cho **Ngừng dùng** hoặc **Dùng lại**.",
      },
      {
        text: "Dán nhiều phiếu nhập hoặc xuất một lúc từ Excel (tối đa 500 dòng), có kiểm tra tồn cộng dồn cả lô.",
      },
      {
        text: "Nhập file Excel theo mẫu RedDoor - NVL (.xlsx, tối đa 5 MB): xem trước từng dòng, chọn có nhập dòng trùng hay không, rồi mới ghi.",
      },
      {
        text: "Xuất Excel theo tab đang xem: **Tổng kho** ra TONG-KHO-NVL.xlsx, **Nhập kho** ra CHI-TIET-NHAP-NVL.xlsx, **Xuất kho** ra CHI-TIET-XUAT-NVL.xlsx, **Danh mục NVL** ra KHO-NVL-2026.xlsx gồm đủ 5 sheet.",
      },
      {
        text: "In tab đang xem trên khổ A4 ngang bằng **In báo cáo**; nút, bộ lọc, form và các khung thông báo được ẩn khỏi bản in.",
      },
      {
        text: "Xem ai đã ghi, sửa, hủy, nhập file, thêm hoặc sửa danh mục và lúc nào trong **Lịch sử chỉnh sửa** (bấm **Tải thêm (n mục còn lại)** để xem cũ hơn).",
      },
    ],
    limits: [
      {
        text: "Form và dán không cho xuất quá số tồn: form khóa nút **Áp dụng**, dán thì dòng đó bị báo lỗi, và hệ thống kiểm tra lại lần nữa khi lưu.",
      },
      {
        text: "Riêng **Nhập Excel** không chặn xuất vượt tồn: các dòng xuất trong file vẫn được ghi dù làm tồn kho âm (vật tư đó hiện **Hết hàng**). Hãy xem lại **Tổng kho** sau mỗi lần nhập file.",
      },
      {
        text: "Không có phiếu điều chỉnh tồn kho trên màn hình này; muốn sửa tồn thì sửa hoặc hủy đúng phiếu nhập / xuất đã ghi.",
      },
      {
        text: "Không xóa hẳn được phiếu: **Hủy dòng** chỉ đánh dấu đã hủy, dòng vẫn còn trong sổ. Dòng đã hủy không sửa được và không có nút khôi phục.",
      },
      {
        text: "Không đổi được loại phiếu (nhập thành xuất hay ngược lại); hãy hủy phiếu sai rồi ghi phiếu mới.",
      },
      {
        text: "Không xóa được vật tư hay cơ sở, chỉ **Ngừng dùng**. Không ghi phiếu mới cho mã đã ngừng dùng (nút **Nhập kho** / **Xuất kho** trong thẻ chi tiết cũng bị khóa). Mã đã có giao dịch thì không đổi mã được.",
      },
      {
        text: "Không được làm tồn kho âm khi hạ **Tồn đầu kỳ**, khi sửa bớt số lượng một phiếu nhập, hoặc khi hủy một phiếu nhập.",
      },
      {
        text: "Nhập file Excel và dán không tự thêm vật tư hay cơ sở mới; mã lạ phải thêm ở **Danh mục NVL** trước.",
      },
      {
        text: "Phiếu xuất không có đơn giá, thành tiền và không có ô **Diễn giải** (luôn là “xuất kho”). Dán từ Excel không nhận đơn giá hay diễn giải; đơn giá chỉ vào sổ qua form phiếu nhập hoặc qua file Excel nhập kho.",
      },
    ],
    flows: [
      {
        title: "Ghi phiếu nhập kho",
        when: "Khi hàng nguyên vật liệu về kho.",
        steps: [
          "Bấm tab **Nhập kho**.",
          "Bấm **Thêm phiếu nhập**.",
          "Kiểm tra **Ngày nhập** (mặc định hôm nay).",
          "Gõ mã hoặc tên vào ô **Mã vật tư**, chọn từ gợi ý; kiểm tra tên và ĐVT hiện bên dưới.",
          "Kiểm tra ô **Diễn giải** (mặc định “nhập kho”).",
          "Nhập **Số lượng** (lớn hơn 0, dùng dấu chấm cho số thập phân).",
          "Nhập **Đơn giá (không bắt buộc)** nếu có; ô **Thành tiền** tự tính.",
          "Nhập **Ghi chú** nếu cần.",
          "Bấm **Áp dụng**.",
        ],
        result:
          "Phiếu được ghi ngay, form đóng lại, khung xanh báo “Đã ghi phiếu nhập …”, tồn kho và các tab tự cập nhật. Không cần ai duyệt.",
      },
      {
        title: "Ghi phiếu xuất kho",
        when: "Khi giao nguyên vật liệu cho một cơ sở hoặc người nhận.",
        steps: [
          "Bấm tab **Xuất kho**.",
          "Bấm **Thêm phiếu xuất**.",
          "Kiểm tra **Ngày xuất**.",
          "Gõ mã hoặc tên vào ô **Cơ sở / người nhận**, chọn từ gợi ý.",
          "Gõ mã hoặc tên vào ô **Mã vật tư**.",
          "Xem **Tồn hiện tại** của vật tư đó.",
          "Nhập **Số lượng xuất**; nếu vượt tồn, dòng chữ đỏ hiện ngay và nút **Áp dụng** bị khóa.",
          "Nhập **Ghi chú** nếu cần.",
          "Bấm **Áp dụng**.",
        ],
        result:
          "Phiếu được ghi ngay, tồn kho giảm tương ứng, khung xanh báo “Đã ghi phiếu xuất …”. Không cần ai duyệt.",
      },
      {
        title: "Nhập hoặc xuất nhanh từ Tổng kho",
        when: "Đang xem một vật tư và muốn ghi phiếu cho đúng vật tư đó.",
        steps: [
          "Ở tab **Tổng kho**, bấm mã hoặc tên vật tư.",
          "Trong thẻ chi tiết, bấm **Nhập kho** hoặc **Xuất kho**.",
          "Điền các ô còn lại trong form (mã vật tư đã điền sẵn).",
          "Bấm **Áp dụng**.",
          "Bấm **Đóng** để đóng thẻ chi tiết khi xong.",
        ],
        result:
          "Phiếu được ghi; số tồn, bảng **Giao dịch** và **Lịch sử thay đổi** trong thẻ tự cập nhật.",
      },
      {
        title: "Sửa một phiếu đã ghi",
        steps: [
          "Mở tab **Nhập kho** hoặc **Xuất kho**.",
          "Tìm phiếu bằng **Từ ngày**, **Đến ngày** hoặc ô **Tìm**.",
          "Bấm **Sửa** ở cột **Thao tác**.",
          "Sửa các ô cần đổi trong form **Sửa phiếu nhập** / **Sửa phiếu xuất**.",
          "Bấm **Áp dụng**.",
        ],
        result:
          "Phiếu được cập nhật, tồn kho tính lại, khung xanh báo “Đã cập nhật phiếu …”. Lần sửa được lưu trong lịch sử kèm giá trị cũ và mới.",
      },
      {
        title: "Hủy một phiếu ghi nhầm",
        steps: [
          "Bấm **Hủy dòng** ở cột **Thao tác** của phiếu.",
          "Đọc lại thông tin phiếu trong khung **Hủy phiếu nhập** / **Hủy phiếu xuất** hiện dưới thanh công cụ.",
          "Nhập **Lý do hủy (bắt buộc)**, ít nhất 3 ký tự.",
          "Bấm **Hủy dòng này**, hoặc **Giữ lại** để thôi.",
        ],
        result:
          "Phiếu được đánh dấu **Đã hủy** (chỉ thấy khi tích **Hiện dòng đã hủy**), tồn kho tính lại, khung xanh báo “Đã hủy phiếu … (mã); tồn kho đã tính lại.”",
      },
      {
        title: "Thêm vật tư hoặc cơ sở mới",
        when: "Có mã nguyên vật liệu mới, hoặc có nơi nhận hàng mới.",
        steps: [
          "Bấm tab **Danh mục NVL**.",
          "Bấm **Thêm vật tư** (thẻ vật tư) hoặc **Thêm cơ sở** (thẻ cơ sở).",
          "Nhập **Mã vật tư** / **Mã cơ sở** (không trùng mã đã có) và **Tên vật tư** / **Tên cơ sở**.",
          "Với vật tư: nhập **ĐVT**, **Tồn đầu kỳ** (mặc định 0), và **Tồn tối thiểu (không bắt buộc)** nếu muốn được báo **Sắp hết**.",
          "Với cơ sở: nhập **Loại** và **SĐT** nếu có.",
          "Nhập **Ghi chú** nếu cần.",
          "Bấm **Áp dụng**.",
        ],
        result:
          "Mã mới xuất hiện trong danh mục và dùng được ngay khi ghi phiếu; khung xanh báo “Đã thêm …”.",
      },
      {
        title: "Sửa thông tin vật tư hoặc cơ sở",
        when: "Đổi tên, ĐVT, tồn đầu kỳ, tồn tối thiểu, loại, SĐT hoặc ghi chú.",
        steps: [
          "Bấm tab **Danh mục NVL**.",
          "Gõ vào ô **Tìm vật tư** hoặc **Tìm cơ sở** để tìm dòng cần sửa.",
          "Bấm **Sửa** ở cột **Thao tác**.",
          "Sửa các ô cần đổi. Ô mã bị khóa và ghi “Mã đã có giao dịch” nếu mã đó đã được dùng trong phiếu.",
          "Bấm **Áp dụng**.",
        ],
        result:
          "Khung xanh báo “Đã cập nhật …”. Các phiếu đã ghi vẫn giữ tên cũ lúc ghi; tồn kho tính lại nếu bạn đổi **Tồn đầu kỳ**.",
      },
      {
        title: "Ngừng dùng hoặc dùng lại một mã",
        steps: [
          "Ở tab **Danh mục NVL**, bấm **Ngừng dùng** trên dòng cần ngừng.",
          "Đọc khung xác nhận, rồi bấm **Ngừng dùng** hoặc **Giữ lại**.",
          "Khi cần dùng lại, bấm **Dùng lại** trên dòng đó (không cần xác nhận).",
        ],
        result:
          "Mã ngừng dùng đổi sang badge **Ngừng dùng**; các phiếu cũ giữ nguyên, nhưng không ghi thêm phiếu mới cho mã đó được cho tới khi bấm **Dùng lại**.",
      },
      {
        title: "Dán nhiều phiếu từ Excel",
        steps: [
          "Bấm **Dán từ Excel** trên thanh công cụ.",
          "Chọn **Loại phiếu**: **Nhập kho** hoặc **Xuất kho**.",
          "Trong Excel, sắp cột theo thứ tự: phiếu nhập là Ngày, Mã vật tư, Số lượng, Ghi chú; phiếu xuất là Ngày, Mã cơ sở, Mã vật tư, Số lượng, Ghi chú. Ngày ghi dạng ngày/tháng/năm, ngày trống lấy hôm nay; chỉ nhận mã, không nhận tên.",
          "Sao chép các dòng trong Excel và dán vào ô **Các dòng từ Excel**.",
          "Bấm **Đọc dữ liệu**.",
          "Xem cột **Kết quả**: dòng **Lỗi** có ghi lý do và sẽ không được ghi.",
          "Bấm **Ghi N dòng**.",
        ],
        result:
          "Các dòng hợp lệ được ghi cùng lúc, khung xanh báo “Đã ghi N phiếu … từ dữ liệu dán; tồn kho đã cập nhật.” Nếu lúc lưu có một dòng bị từ chối thì cả lô không được ghi, nội dung dán vẫn còn để sửa.",
      },
      {
        title: "Nhập file Excel sổ NVL",
        steps: [
          "Bấm **Nhập Excel** và chọn file .xlsx theo mẫu RedDoor - NVL (có sheet ChiTietNhapNVL hoặc ChiTietxuatNVL, tối đa 5 MB).",
          "Đọc khung vàng “Dữ liệu đọc từ file … — chưa ghi vào kho” và số dòng theo từng trạng thái.",
          "Xem cột **Trạng thái** và **Ghi chú kiểm tra** của từng dòng.",
          "Nếu có **Vật tư lạ** hoặc **Cơ sở lạ**, thêm mã đó ở **Danh mục NVL** rồi chọn lại file.",
          "Chỉ tích **Nhập cả các dòng trùng** khi chắc chắn đó là giao dịch khác thật.",
          "Bấm **Nhập N dòng vào kho**.",
          "Mở tab **Tổng kho** kiểm tra có vật tư nào bị **Hết hàng** bất thường không.",
        ],
        result:
          "Khung xanh báo “Đã nhập N dòng từ … vào kho, bỏ qua M dòng.” và tồn kho cập nhật. Muốn bỏ, bấm **Hủy nhập file** rồi xác nhận **Hủy nhập file** (hoặc **Giữ lại dữ liệu vừa đọc**); không có gì được ghi.",
      },
      {
        title: "Xuất Excel hoặc in báo cáo",
        steps: [
          "Bấm tab cần xuất hoặc in.",
          "Ở **Nhập kho** / **Xuất kho**, đặt **Từ ngày**, **Đến ngày**, **Tìm** nếu chỉ cần một phần sổ.",
          "Trước khi in, bấm **Tải thêm (n dòng còn lại)** cho tới hết nếu cần in đủ sổ.",
          "Bấm **Xuất Excel** để tải file, hoặc **In báo cáo** để mở hộp in của trình duyệt.",
          "Khi in, chọn máy in hoặc lưu thành file PDF trong hộp in.",
        ],
        result:
          "Khung xanh báo “Đã tải file Excel của tab đang xem.” File sổ nhập / xuất gồm mọi phiếu chưa hủy khớp bộ lọc (kể cả phần chưa tải lên màn hình) và không có dòng đã hủy dù đang tích **Hiện dòng đã hủy**; file **Tổng kho** luôn lấy bảng tổng kho mặc định, không theo bộ lọc của tab; file **Danh mục NVL** lấy toàn bộ kho. Bản in chỉ gồm những gì đang hiện trên màn hình của tab đó.",
      },
    ],
    terms: [
      {
        term: "NVL",
        meaning: "Viết tắt của nguyên vật liệu.",
      },
      {
        term: "Tồn đầu / Tồn đầu kỳ",
        meaning:
          "Số tồn lúc bắt đầu sổ năm 2026 của vật tư, nhập và sửa ở **Danh mục NVL**.",
      },
      {
        term: "Tồn cuối",
        meaning:
          "Tồn đầu + Nhập − Xuất, chỉ tính các phiếu chưa hủy. Hệ thống tự tính, không gõ tay.",
      },
      {
        term: "Tồn tối thiểu",
        meaning:
          "Ngưỡng báo sắp hết. Không bắt buộc; để trống thì vật tư không bao giờ hiện **Sắp hết**.",
      },
      {
        term: "Còn hàng / Sắp hết / Hết hàng",
        meaning:
          "**Hết hàng**: tồn cuối bằng 0 hoặc âm. **Sắp hết**: tồn cuối không vượt tồn tối thiểu. **Còn hàng**: các trường hợp còn lại. Mã đã ngừng dùng hiện **Ngừng dùng** thay cho ba trạng thái này.",
      },
      {
        term: "Ngừng dùng / Đang dùng",
        meaning:
          "Trạng thái của mã trong danh mục. Mã ngừng dùng vẫn giữ phiếu cũ nhưng không ghi phiếu mới được.",
      },
      {
        term: "Vật tư đang theo dõi",
        meaning:
          "Vật tư đang dùng có tồn đầu, có tồn tối thiểu hoặc đã có nhập / xuất. Ba ô **Còn hàng**, **Sắp hết**, **Hết hàng** chỉ đếm các vật tư này; ô **Ngừng dùng** đếm mã đã ngừng dùng nhưng còn số nhập, xuất hoặc tồn.",
      },
      {
        term: "Đã hủy",
        meaning:
          "Phiếu đã bị hủy: chữ gạch ngang, cột **Ghi chú** có “Lý do hủy: …”, không còn tính vào tồn kho.",
      },
      {
        term: "Tồn sau",
        meaning: "Trong thẻ chi tiết vật tư: số tồn ngay sau giao dịch đó.",
      },
      {
        term: "Σ nhập / Σ xuất",
        meaning:
          "Tổng số lượng đã nhập / đã xuất của vật tư (Σ nghĩa là tổng).",
      },
      {
        term: "Người ghi / Ghi lúc",
        meaning:
          "Người ghi, sửa hoặc hủy phiếu gần nhất và thời điểm đó. “Chuyển từ Excel” là dòng chuyển từ file cũ sang.",
      },
      {
        term: "ĐVT / SĐT",
        meaning: "Đơn vị tính / số điện thoại.",
      },
      {
        term: "Hợp lệ / Lỗi (khi dán, nhập file)",
        meaning:
          "**Hợp lệ**: dòng sẽ được ghi. **Lỗi**: dòng thiếu dữ liệu, sai số, dùng mã đã ngừng dùng hoặc (khi dán phiếu xuất) vượt tồn; không được ghi.",
      },
      {
        term: "Trùng / Đã nhập (khi nhập file)",
        meaning:
          "**Trùng**: giống một phiếu đã có (cùng loại, ngày, mã, số lượng, ghi chú), chỉ ghi khi tích **Nhập cả các dòng trùng**. **Đã nhập**: dòng đã được nhập từ đúng file này trước đây, luôn bỏ qua.",
      },
      {
        term: "Vật tư lạ / Cơ sở lạ",
        meaning:
          "Mã vật tư hoặc mã cơ sở trong file chưa có trong danh mục; không nhập được cho tới khi thêm mã ở **Danh mục NVL**.",
      },
      {
        term: "KhoNVL, Cososx, Sheet",
        meaning:
          "Sheet là một trang tính trong file Excel. KhoNVL và Cososx là tên sheet danh mục vật tư và danh sách cơ sở trong file Excel cũ; ChiTietNhapNVL và ChiTietxuatNVL là sổ nhập và sổ xuất; Tong kho NVL là bảng tổng kho.",
      },
      {
        term: "Excel, .xlsx, PDF",
        meaning:
          "Excel là phần mềm bảng tính, .xlsx là đuôi file Excel. PDF là loại file tài liệu bạn có thể chọn khi in để lưu bản in thành file.",
      },
    ],
    tips: [
      {
        text: "Dòng chữ đỏ hoặc khung đỏ “Số lượng xuất vượt quá tồn kho hiện tại. Tồn hiện tại: … · Yêu cầu xuất: …” nghĩa là kho không đủ hàng. Kiểm tra lại số lượng, hoặc ghi phiếu nhập còn thiếu trước.",
      },
      {
        text: "“Dữ liệu đã được người khác thay đổi. Bản nháp của bạn vẫn được giữ; tải lại để đối chiếu.” nghĩa là có người vừa sửa cùng phiếu hoặc cùng mã; số liệu tự tải lại. Nếu form phiếu vẫn mở, bấm **Hủy**, chọn **Bỏ thay đổi và tiếp tục**, rồi bấm **Sửa** lại trên dòng mới tải để làm lại (bấm **Áp dụng** ngay sẽ bị từ chối lần nữa). “Dòng đã bị hủy; tải lại để đối chiếu.” là phiếu đã bị hủy trong lúc bạn sửa.",
      },
      {
        text: 'Lỗi danh mục thường gặp: “Mã "…" đã tồn tại.” (trùng mã), “Mã đã có giao dịch; không đổi mã.”, “Tồn đầu mới làm tồn kho âm…”, “Vật tư "…" đã ngừng sử dụng.” hoặc “Cơ sở "…" đã ngừng sử dụng.” (bấm **Dùng lại** ở **Danh mục NVL** nếu thật sự cần).',
      },
      {
        text: "Dưới ô nhập có chữ đỏ “Chưa chọn mã vật tư”, “Chưa chọn cơ sở / người nhận” hoặc “Số lượng phải lớn hơn 0” khi bạn bấm **Áp dụng** mà còn thiếu. Số thập phân dùng dấu chấm (0.3); gõ 0,3 sẽ bị báo “Dùng dấu chấm cho số thập phân (ví dụ 0.3); dấu phẩy chỉ phân cách hàng nghìn.”",
      },
      {
        text: "Nếu dòng gợi ý dưới ô mã ghi “Không có trong danh mục” thì mã gõ sai hoặc chưa được thêm; nếu ghi “đã ngừng dùng” thì phiếu sẽ bị từ chối.",
      },
      {
        text: "Lỗi khi chọn file: “Chọn file .xlsx theo mẫu RedDoor - NVL, tối đa 5 MB.”, “Tệp không có sheet ChiTietNhapNVL hoặc ChiTietxuatNVL.” Nếu không còn dòng nào nhập được, nút hiện **Nhập 0 dòng vào kho** và không bấm được. Dán quá 500 dòng sẽ báo “Tối đa 500 dòng mỗi lần dán.”",
      },
      {
        text: "“Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.” là lỗi mạng. “Đã ghi phiếu nhưng chưa tải lại được số liệu; hãy tải lại trang để đối chiếu.” nghĩa là phiếu đã lưu rồi, đừng ghi lại lần nữa; chỉ cần tải lại trang. “Bạn không có quyền thao tác kho nguyên vật liệu.” thường do phiên đăng nhập đã hết; hãy đăng nhập lại.",
      },
      {
        text: "Khi đang sửa dở mà chuyển tab, mở phiếu hay vật tư khác, bấm **Hủy** hoặc **Hủy dòng**, khung “Phiếu đang sửa có thay đổi chưa áp dụng. Tiếp tục sẽ bỏ những thay đổi đó.” hiện ra: bấm **Bỏ thay đổi và tiếp tục** hoặc **Quay lại chỉnh sửa**. Đóng hay tải lại trang lúc này, trình duyệt cũng hỏi lại.",
      },
      {
        text: "Khung xanh “Đã đọc N dòng từ …: M hợp lệ.” sau khi chọn file chỉ là đã đọc xong; phải bấm **Nhập N dòng vào kho** trong khung vàng thì mới ghi.",
      },
      {
        text: "Thói quen tốt: ghi rõ lý do khi hủy phiếu, đặt **Tồn tối thiểu** cho vật tư quan trọng để thấy **Sắp hết** kịp thời, và xem **Lịch sử chỉnh sửa** khi số tồn khác với kiểm đếm thực tế.",
      },
    ],
  },
];
