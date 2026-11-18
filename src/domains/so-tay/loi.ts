/**
 * Lỗi nghiệp vụ của Sổ tay: câu tiếng Việt ngắn, kèm mã HTTP để API trả về.
 */
export class LoiSoTay extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "LoiSoTay";
  }
}

export const khongTimThay = (vat: string) =>
  new LoiSoTay(`Không tìm thấy ${vat}.`, 404);

/**
 * Cảnh báo cần xác nhận: người dùng bấm lần nữa (gửi kèm `xacNhan: true`) thì
 * mới lưu, ví dụ đề nghị thanh toán vượt số còn có thể đề nghị.
 */
export class CanhBao extends LoiSoTay {
  readonly canhBao = true;
  constructor(message: string) {
    super(message, 409);
    this.name = "CanhBao";
  }
}
