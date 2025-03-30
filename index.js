const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const dotenv = require('dotenv');
const {
  S3Client,
  PutObjectCommand
} = require('@aws-sdk/client-s3');
const {
  DynamoDBClient
} = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand
} = require('@aws-sdk/lib-dynamodb');

dotenv.config();
const app = express();
const port = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('./views'));
app.set('view engine', 'ejs');
app.set('views', './views');

// S3 config
const s3 = new S3Client({
  region: 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// DynamoDB config
const ddb = new DynamoDBClient({
  region: 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
const docClient = DynamoDBDocumentClient.from(ddb);

const tableName = 'ThanhNamTable';

// Multer cấu hình lưu file tạm
const upload = multer({
  dest: 'uploads/',
  fileFilter: function (req, file, cb) {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép upload ảnh'));
    }
  }
});

// GET /
app.get('/', async (req, res) => {
  try {
    const data = await docClient.send(new ScanCommand({ TableName: tableName }));
    res.render('index', { sanPhams: data.Items });
  } catch (err) {
    console.error('LỖI LẤY DỮ LIỆU:', err);
    res.send('Internal Server Error');
  }
});

// POST /add
app.post('/add', upload.single('image'), async (req, res) => {
  const { ma_sp, ten_sp, so_luong } = req.body;
  let fileUrl = '';
  let fileName = '';

  try {
    if (req.file) {
      const fileContent = fs.readFileSync(req.file.path);
      const extension = path.extname(req.file.originalname);
      const s3Key = `${uuid()}${extension}`;

      const uploadParams = {
        Bucket: 'nambk',
        Key: s3Key,
        Body: fileContent,
        ContentType: req.file.mimetype
      };

      await s3.send(new PutObjectCommand(uploadParams));
      fileUrl = `${process.env.CLOUD_FRONT_URL}/${s3Key}`;
      fileName = req.file.originalname;
      fs.unlinkSync(req.file.path); // Xóa file tạm
    }

    const item = {
      maSanPham: Number(ma_sp),
      ten_sp,
      so_luong: Number(so_luong),
      file: fileUrl,
      fileName: fileName
    };

    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: item
    }));

    res.redirect('/');
  } catch (err) {
    console.error('LỖI THÊM:', err);
    res.send('Lỗi upload hoặc lưu dữ liệu!');
  }
});

// POST /delete
app.post('/delete', upload.none(), async (req, res) => {
  const selected = req.body.selected;
  if (!selected) return res.redirect('/');
  const ids = Array.isArray(selected) ? selected : [selected];

  try {
    for (let id of ids) {
      await docClient.send(new DeleteCommand({
        TableName: tableName,
        Key: { maSanPham: Number(id) }
      }));
    }
    res.redirect('/');
  } catch (err) {
    console.error("LỖI XÓA:", err);
    res.send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
