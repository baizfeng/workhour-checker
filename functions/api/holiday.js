// functions/api/holiday.js
// Cloudflare Pages Function - 节假日 API 代理

export async function onRequest(context) {
  const { request } = context;
  
  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  // 仅允许 GET 请求
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { 
      status: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  
  if (!date) {
    return new Response(JSON.stringify({ 
      error: '缺少 date 参数',
      example: '/api/holiday?date=2025-10-01'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  // 验证日期格式
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(date)) {
    return new Response(JSON.stringify({ 
      error: '日期格式错误，应为 YYYY-MM-DD'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  try {
    // 请求原始节假日 API
    const apiUrl = `https://holiday.dreace.top?date=${date}`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Cloudflare-Worker-Proxy'
      }
    });

    if (!response.ok) {
      throw new Error(`API 返回错误: ${response.status}`);
    }

    const data = await response.json();

    // 返回结果并添加 CORS 头
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400', // 缓存 24 小时
      }
    });

  } catch (error) {
    console.error('节假日 API 请求失败:', error);
    
    // 降级方案：基于星期判断
    const dateObj = new Date(date + 'T00:00:00');
    const day = dateObj.getDay();
    const isWeekend = day === 0 || day === 6;
    
    const fallbackData = {
      isHoliday: isWeekend,
      type: isWeekend ? '假日' : '工作日',
      note: isWeekend ? '周末' : '普通工作日',
      fallback: true, // 标记为降级数据
      error: error.message
    };

    return new Response(JSON.stringify(fallbackData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'X-Fallback-Mode': 'true',
      }
    });
  }
}