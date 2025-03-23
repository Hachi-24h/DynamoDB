const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const app = express();
const port = 3000;
const dotenv = require('dotenv');
dotenv.config();
app.use(express.urlencoded({ extended: true }));
// phan thanh nam demo
app.use(express.static('./views'));
app.set('view engine', 'ejs');
app.set('views', './views');

const config = new AWS.Config({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'ap-southeast-2',
});
AWS.config = config;

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = 'ThanhNamTable';
const upload = multer();

app.get('/', (req, res) => {
  const params = { TableName: tableName };
  docClient.scan(params, (err, data) => {
    if (err) {
      console.error("LỖI LẤY DỮ LIỆU:", err);
      res.send('Internal Server Error');
    } else {
      res.render('index', { sanPhams: data.Items });
    }
  });
});


app.post('/add', upload.fields([]), (req, res) => {
  const { ma_sp, ten_sp, so_luong } = req.body;

  const params = {
    TableName: tableName,
    Item: {
      maSanPham: Number(ma_sp),
      ten_sp,
      so_luong: Number(so_luong)
    }
  };

  docClient.put(params, (err, data) => {
    if (err) {
      console.error("LỖI THÊM:", err);
      return res.send('Internal Server Error');
    } else {
      return res.redirect('/');
    }
  });
});

// Xoá sản phẩm
app.post('/delete', upload.fields([]), (req, res) => {
  const selected = req.body.selected;
  if (!selected) return res.redirect('/');
  const ids = Array.isArray(selected) ? selected : [selected];

  const deletePromises = ids.map(id => {
    const params = {
      TableName: tableName,
      Key: { maSanPham: Number(id) }
    };
    return docClient.delete(params).promise();
  });

  Promise.all(deletePromises)
    .then(() => res.redirect('/'))
    .catch(err => {
      console.error("LỖI XÓA:", err);
      res.send('Internal Server Error');
    });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
