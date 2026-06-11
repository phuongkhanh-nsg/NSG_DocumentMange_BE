const TEMPPASSWORD_EMAIL_TEMPLATE = ` 
<!DOCTYPE html> 
<html lang="vi"> 
<head> 
  <meta charset="UTF-8"> 
  <meta name="viewport" content="width=device-width, initial-scale=1.0"> 
  <title>Xác nhận email</title> 
</head> 
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"> 
  <div style="background: linear-gradient(to right, #A3AAAE, #E0E0E0); padding: 20px; text-align: center;"> 
    <h1 style="color: #333; margin: 0;">Xác nhận email</h1> 
  </div> 
  <div style="background-color: #F2F2F5; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);"> 
    <p>Xin chào,</p> 
    <p>Cảm ơn bạn đã khôi phục tài khoản! Mã xác minh của bạn là:</p> 
    <div style="text-align: center; margin: 30px 0;"> 
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0071E3;">{tempPass}</span> 
    </div> 
    <p>Nhập mã này vào trang xác minh để hoàn tất quá trình khôi phục tài khoản.</p> 
    <p>Vì lý do bảo mật, mã này sẽ hết hạn sau 1 phút.</p> 
    
    <p>Trân trọng,<br>Phòng Tổ chức - Hành chính</p> 
  </div> 
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;"> 
    <p>Đây là email tự động, vui lòng không trả lời email này.</p> 
  </div> 
</body> 
</html> 
`;

module.exports = {
  TEMPPASSWORD_EMAIL_TEMPLATE,
}
