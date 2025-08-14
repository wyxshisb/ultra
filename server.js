require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 配置数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API端点 - 登记毕业生信息
app.post('/api/register', async (req, res) => {
  try {
    const { name, school, year, destination, question, answer } = req.body;
    
    // 检查是否已存在相同姓名的记录
    const checkQuery = 'SELECT * FROM graduates WHERE name = $1';
    const checkResult = await pool.query(checkQuery, [name]);
    
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: '该姓名已登记，请使用其他姓名或联系管理员' });
    }
    
    // 插入新记录
    const query = `
      INSERT INTO graduates (name, school, year, destination, question, answer)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [name, school, year, destination, question, answer];
    const result = await pool.query(query, values);
    
    res.status(201).json({ 
      message: '信息登记成功！', 
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('登记错误:', error);
    res.status(500).json({ message: '服务器错误，登记失败' });
  }
});

// API端点 - 查找毕业生
app.get('/api/search', async (req, res) => {
  try {
    const { name } = req.query;
    
    const query = 'SELECT id, name, question FROM graduates WHERE name = $1';
    const result = await pool.query(query, [name]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: '该人并未入库' });
    }
    
    res.json({ 
      message: '找到匹配记录', 
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('查询错误:', error);
    res.status(500).json({ message: '服务器错误，查询失败' });
  }
});

// API端点 - 验证答案并获取信息
app.post('/api/verify', async (req, res) => {
  try {
    const { id, answer } = req.body;
    
    const query = `
      SELECT name, school, year, destination 
      FROM graduates 
      WHERE id = $1 AND answer = $2
    `;
    const result = await pool.query(query, [id, answer]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: '答案不正确，请重试' });
    }
    
    res.json({ 
      message: '验证成功', 
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('验证错误:', error);
    res.status(500).json({ message: '服务器错误，验证失败' });
  }
});

// 初始化数据库表
app.get('/api/init', async (req, res) => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS graduates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        school VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        destination VARCHAR(200) NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await pool.query(query);
    res.json({ message: '数据库表初始化成功' });
  } catch (error) {
    console.error('初始化表错误:', error);
    res.status(500).json({ message: '数据库表初始化失败' });
  }
});

// 提供前端页面
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
    