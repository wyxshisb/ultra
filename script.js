// 加密配置
const ENCRYPTION_KEY = CryptoJS.enc.Utf8.parse('graduateTrackerKey123');
const IV = CryptoJS.enc.Utf8.parse('1234567890abcdef');

// 加密函数
function encryptData(data) {
    if (!data) return '';
    return CryptoJS.AES.encrypt(
        JSON.stringify(data),
        ENCRYPTION_KEY,
        { iv: IV, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    ).toString();
}

// 解密函数
function decryptData(encryptedData) {
    if (!encryptedData) return null;
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY, {
            iv: IV,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
        console.error('解密失败:', error);
        showToast('数据解密失败', false);
        return null;
    }
}

// 页面切换
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// 提示框
function showToast(message, isSuccess = true) {
    const toast = document.createElement('div');
    toast.className = `toast ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 全局POST请求拦截
function setupRequestInterceptor() {
    const originalFetch = window.fetch;
    window.fetch = async function(url, options = {}) {
        if (url.includes('/functions/')) {
            options.method = 'POST';
            options.headers = {
                'Content-Type': 'application/json; charset=UTF-8',
                ...options.headers
            };
            console.log(`[请求拦截] 强制POST请求: ${url}`);
        }
        return originalFetch.call(this, url, options);
    };
}

// 注册表单处理
function setupRegisterForm() {
    const form = document.getElementById('register-form');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // 毕业年份验证
        const graduationYearInput = document.getElementById('graduation-year');
        const graduationYearValue = graduationYearInput.value.trim();
        const yearErrorEl = document.getElementById('graduation-year-error');
        let isYearValid = true;

        if (!graduationYearValue) {
            isYearValid = false;
            yearErrorEl.textContent = '毕业年份不能为空';
        } else if (!/^\d{4}$/.test(graduationYearValue)) {
            isYearValid = false;
            yearErrorEl.textContent = '请输入4位数字（如2023）';
        }

        if (!isYearValid) {
            yearErrorEl.style.display = 'block';
            graduationYearInput.focus();
            return;
        } else {
            yearErrorEl.style.display = 'none';
        }

        // 收集表单数据
        const formData = {
            name: sanitizeInput(document.getElementById('name').value.trim()),
            highschool: sanitizeInput(document.getElementById('highschool').value.trim()),
            graduation_year: graduationYearValue,
            class_name: sanitizeInput(document.getElementById('class-name').value.trim()),
            destination_type: document.getElementById('destination-type').value,
            destination: encryptData(sanitizeInput(document.getElementById('destination').value.trim())),
            description: encryptData(sanitizeInput(document.getElementById('description').value.trim())),
            security_question: encryptData(sanitizeInput(document.getElementById('security-question').value.trim())),
            security_answer: encryptData(sanitizeInput(document.getElementById('security-answer').value.trim()))
        };

        // 验证必填字段
        const requiredFields = ['name', 'highschool', 'destination_type', 'destination', 'security_question', 'security_answer'];
        const emptyFields = requiredFields.filter(field => !formData[field]);
        if (emptyFields.length > 0) {
            showToast(`请填写所有必填字段: ${emptyFields.join(', ')}`, false);
            return;
        }

        try {
            const response = await fetch('/.netlify/functions/save-graduate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (result.success) {
                showToast('数据保存成功！', true);
                form.reset();
            } else {
                showToast(`保存失败: ${result.error || '未知错误'}`, false);
            }
        } catch (error) {
            console.error('提交失败:', error);
            showToast('网络错误，提交失败', false);
        }
    });
}

// 查询功能处理
function setupSearchFunction() {
    const searchForm = document.getElementById('search-form');
    const resultsContainer = document.getElementById('results-container');
    const queryNameInput = document.getElementById('query-name');
    const querySchoolInput = document.getElementById('query-school');

    if (!searchForm || !resultsContainer) return;

    // 阻止默认提交
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        performSearch();
    });

    // 绑定查询触发
    document.querySelector('#search-form button[type="submit"]').addEventListener('click', performSearch);
    [queryNameInput, querySchoolInput].forEach(input => {
        input.addEventListener('keydown', (e) => e.key === 'Enter' && performSearch());
    });

    async function performSearch() {
        const name = sanitizeInput(queryNameInput.value.trim());
        const highschool = sanitizeInput(querySchoolInput.value.trim());

        if (!name && !highschool) {
            showToast('请至少输入姓名或学校', false);
            return;
        }

        resultsContainer.innerHTML = '<div class="loading">查询中...</div>';

        try {
            const response = await fetch('/.netlify/functions/search-graduate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, highschool })
            });

            if (!response.ok) {
                throw new Error(`请求失败: ${response.status}`);
            }

            const result = await response.json();
            resultsContainer.innerHTML = '';

            if (result.success && result.count > 0) {
                result.data.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'result-card border p-4 rounded mb-3';
                    card.innerHTML = `
                        <h3 class="font-semibold">${item.name}</h3>
                        <p><strong>学校:</strong> ${item.highschool}</p>
                        <p><strong>毕业年份:</strong> ${item.graduation_year}</p>
                        <p><strong>班级:</strong> ${item.class_name || '未填写'}</p>
                        <p><strong>安全问题:</strong> ${decryptData(item.security_question) || '加载失败'}</p>
                        <button onclick="verifyAnswer(${item.id})" class="btn mt-2">验证答案</button>
                    `;
                    resultsContainer.appendChild(card);
                });
            } else {
                resultsContainer.innerHTML = `<div class="no-results">${result.error || '未找到匹配记录'}</div>`;
            }
        } catch (error) {
            console.error('查询错误:', error);
            resultsContainer.innerHTML = `<div class="error-text">查询失败: ${error.message}</div>`;
        }
    }
}

// 答案验证
window.verifyAnswer = async function(graduateId) {
    const answer = prompt('请输入安全问题的答案:');
    if (!answer) return;

    try {
        const response = await fetch('/.netlify/functions/verify-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id: graduateId, 
                answer: sanitizeInput(answer.trim()) 
            })
        });

        const result = await response.json();
        if (result.success) {
            showToast(result.isCorrect ? '答案正确' : '答案不正确', result.isCorrect);
        } else {
            showToast(`验证失败: ${result.error}`, false);
        }
    } catch (error) {
        console.error('验证错误:', error);
        showToast('验证失败', false);
    }
};

// 特殊字符处理
function sanitizeInput(str) {
    if (!str) return '';
    return str.replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    setupRequestInterceptor();
    setupRegisterForm();
    setupSearchFunction();

    // 页面切换事件
    document.getElementById('to-register').addEventListener('click', () => showPage('register-page'));
    document.getElementById('to-search').addEventListener('click', () => showPage('search-page'));
    document.getElementById('back-home1').addEventListener('click', () => showPage('home-page'));
    document.getElementById('back-home2').addEventListener('click', () => showPage('home-page'));

    console.log('页面初始化完成');
});
    