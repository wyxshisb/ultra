const { Pool } = require('pg');
const CryptoJS = require('crypto-js');

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: '只支持POST请求' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    
    // 毕业年份验证
    const year = data.graduation_year?.toString()?.trim();
    if (!year) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ success: false, error: '毕业年份不能为空' }) 
      };
    }
    if (!/^\d{4}$/.test(year)) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ success: false, error: '毕业年份必须是4位数字（如2023）' }) 
      };
    }

    // 其他必填字段验证
    const requiredFields = ['name', 'highschool', 'destination_type', 'destination', 'security_question', 'security_answer'];
    for (const field of requiredFields) {
      if (!data[field] || data[field].trim() === '') {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ success: false, error: `${field}不能为空` }) 
        };
      }
    }

    // 执行插入
    const result = await pool.query(
      `INSERT INTO graduates (
        name, highschool, graduation_year, class_name, destination_type,
        destination, description, security_question, security_answer, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id`,
      [
        data.name.trim(),
        data.highschool.trim(),
        year,  // 使用验证后的毕业年份
        data.class_name?.trim() || null,
        data.destination_type,
        data.destination,
        data.description || null,
        data.security_question,
        data.security_answer
      ]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id: result.rows[0].id })
    };
  } catch (error) {
    console.error('保存失败:', error);
    if (error.code === '23502') {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ 
          success: false, 
          error: `必填字段缺失：${error.column || '毕业年份'}不能为空` 
        }) 
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: '保存失败，请重试' })
    };
  }
};
    