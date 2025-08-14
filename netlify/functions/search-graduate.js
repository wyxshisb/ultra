const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  console.log(`[查询请求] 方法: ${event.httpMethod}, 路径: ${event.path}`);

  if (event.httpMethod !== 'POST') {
    console.error(`[错误] 拒绝${event.httpMethod}请求`);
    return {
      statusCode: 405,
      body: JSON.stringify({
        success: false,
        error: `只支持POST请求，收到: ${event.httpMethod}`
      })
    };
  }

  try {
    const { name, highschool } = JSON.parse(event.body || '{}');
    const params = [];
    const conditions = [];

    if (name) {
      params.push(`%${name}%`);
      conditions.push(`name ILIKE $${params.length}`);
    }
    if (highschool) {
      params.push(`%${highschool}%`);
      conditions.push(`highschool ILIKE $${params.length}`);
    }

    if (conditions.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, count: 0, data: [] })
      };
    }

    const query = `
      SELECT id, name, highschool, graduation_year, class_name, security_question 
      FROM graduates 
      WHERE ${conditions.join(' AND ')}
      ORDER BY graduation_year DESC
    `;

    const result = await pool.query(query, params);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        data: result.rows
      })
    };
  } catch (error) {
    console.error('查询错误:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: '查询失败' })
    };
  }
};
    