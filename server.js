require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const compression = require('compression'); // 启用压缩

const app = express();
const port = process.env.PORT || 3000;

// 启用Gzip压缩
app.use(compression());

// 配置数据库连接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // 连接池最大连接数
  idleTimeoutMillis: 30000 // 连接空闲超时时间
});

// 中间件优化
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGIN : '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '10kb' })); // 限制请求体大小
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '30d',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// API响应缓存
const apiCache = new Map();
const CACHE_TTL = 30000; // 缓存30秒

// 登记毕业生信息
app.post('/api/register', async (req, res) => {
  try {
    const { name, school, year, destination, question, answer } = req.body;
    
    // 输入验证
    if (!name || !school || !year || !destination || !question || !answer) {
      return res.status(400).json({ message: '请填写所有必填字段' });
    }
    
    // 检查重复姓名
    const checkQuery = 'SELECT * FROM graduates WHERE name = $1';
    const checkResult = await pool.query(checkQuery, [name]);
    
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: '该姓名已登记，请使用其他姓名' });
    }
    
    // 插入新记录
    const query = `
      INSERT INTO graduates (name, school, year, destination, question, answer)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [name, school, year, destination, question, answer];
    const result = await pool.query(query, values);
    
    // 清除相关缓存
    apiCache.delete(`search:${name}`);
    
    res.status(201).json({ 
      message: '信息登记成功！', 
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('登记错误:', error);
    res.status(500).json({ message: '服务器错误，登记失败' });
  }
});

// 查找毕业生（带缓存）
app.get('/api/search', async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({ message: '请提供查询姓名' });
    }
    
    // 检查缓存
    const cacheKey = `search:${name}`;
    const cachedData = apiCache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return res.json(cachedData.data);
    }
    
    // 数据库查询
    const query = 'SELECT id, name, question FROM graduates WHERE name = $1';
    const result = await pool.query(query, [name]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: '该人并未入库' });
    }
    
    // 存入缓存
    const responseData = { 
      message: '找到匹配记录', 
      data: result.rows[0] 
    };
    apiCache.set(cacheKey, {
      timestamp: Date.now(),
      data: responseData
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('查询错误:', error);
    res.status(500).json({ message: '服务器错误，查询失败' });
  }
});

// 验证答案并获取信息
app.post('/api/verify', async (req, res) => {
  try {
    const { id, answer } = req.body;
    
    if (!id || !answer) {
      return res.status(400).json({ message: '请提供验证信息' });
    }
    
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
