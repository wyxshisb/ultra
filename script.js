// DOM 元素
const loader = document.getElementById('loader');
const appContainer = document.getElementById('app-container');
const homePage = document.getElementById('home-page');
const registerPage = document.getElementById('register-page');
const queryPage = document.getElementById('query-page');
const infoModal = document.getElementById('info-modal');
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toast-icon');
const toastMessage = document.getElementById('toast-message');

// 页面切换按钮
const registerBtn = document.getElementById('register-btn');
const queryBtn = document.getElementById('query-btn');
const backFromRegisterBtn = document.getElementById('back-from-register');
const backFromQueryBtn = document.getElementById('back-from-query');
const infoBtn = document.getElementById('info-btn');
const closeInfoBtn = document.getElementById('close-info');
const confirmInfoBtn = document.getElementById('confirm-info');

// 登记表单
const registerForm = document.getElementById('register-form');

// 查询相关元素
const nameForm = document.getElementById('name-form');
const nameInputSection = document.getElementById('name-input-section');
const questionVerificationSection = document.getElementById('question-verification-section');
const resultSection = document.getElementById('result-section');
const questionLabel = document.getElementById('question-label');
const answerInput = document.getElementById('answer-input');
const cancelQueryBtn = document.getElementById('cancel-query');
const submitAnswerBtn = document.getElementById('submit-answer');
const newQueryBtn = document.getElementById('new-query');
const foundResult = document.getElementById('found-result');
const notFoundResult = document.getElementById('not-found-result');
const wrongAnswerResult = document.getElementById('wrong-answer-result');

// 结果展示元素
const resultName = document.getElementById('result-name');
const resultSchool = document.getElementById('result-school');
const resultYear = document.getElementById('result-year');
const resultDestination = document.getElementById('result-destination');

// 当前查询的用户数据
let currentUserData = null;

// 初始化页面
window.addEventListener('DOMContentLoaded', () => {
    // 模拟加载过程
    setTimeout(() => {
        loader.classList.add('opacity-0');
        setTimeout(() => {
            loader.style.display = 'none';
            appContainer.classList.add('opacity-100');
        }, 500);
    },1000);

    // 检查是否有Neon数据库连接
    if (!window.neon) {
        showToast('警告', 'Neon插件未加载，数据功能可能无法正常使用', 'exclamation-triangle', 'orange-500');
    }
});

// 页面切换逻辑
registerBtn.addEventListener('click', () => {
    homePage.classList.add('hidden');
    registerPage.classList.remove('hidden');
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

queryBtn.addEventListener('click', () => {
    homePage.classList.add('hidden');
    queryPage.classList.remove('hidden');
    resetQuery流程();
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

backFromRegisterBtn.addEventListener('click', () => {
    registerPage.classList.add('hidden');
    homePage.classList.remove('hidden');
});

backFromQueryBtn.addEventListener('click', () => {
    queryPage.classList.add('hidden');
    homePage.classList.remove('hidden');
});

// 信息模态框
infoBtn.addEventListener('click', () => {
    infoModal.classList.remove('hidden');
});

closeInfoBtn.addEventListener('click', () => {
    infoModal.classList.add('hidden');
});

confirmInfoBtn.addEventListener('click', () => {
    infoModal.classList.add('hidden');
});

// 显示提示信息
function showToast(title, message, icon, color = 'primary') {
    toastIcon.className = `fa fa-${icon} mr-2`;
    toastMessage.textContent = `${title}：${message}`;
    toast.className = `fixed bottom-6 left-1/2 transform -translate-x-1/2 text-white px-6 py-3 rounded-lg shadow-lg opacity-100 transition-opacity duration-300 flex items-center z-50 bg-${color}`;
    
    setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0');
    }, 3000);
}

// 登记表单提交
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(registerForm);
    const data = {
        name: formData.get('name').trim(),
        school: formData.get('school').trim(),
        graduationYear: formData.get('graduation-year').trim(),
        destination: formData.get('destination').trim(),
        queryQuestion: formData.get('query-question').trim(),
        queryAnswer: formData.get('query-answer').trim()
    };
    
    try {
        // 检查是否已存在相同姓名的记录
        const existingRecords = await fetchRecords(`name = '${data.name}'`);
        if (existingRecords.length > 0) {
            if (confirm(`已存在姓名为"${data.name}"的记录，是否覆盖？`)) {
                // 删除现有记录
                await deleteRecords(`name = '${data.name}'`);
            } else {
                return;
            }
        }
        
        // 保存新记录
        await saveRecord(data);
        showToast('成功', '信息已保存', 'check-circle', 'secondary');
        registerForm.reset();
        
        // 返回首页
        setTimeout(() => {
            registerPage.classList.add('hidden');
            homePage.classList.remove('hidden');
        }, 1500);
    } catch (error) {
        console.error('保存失败:', error);
        showToast('错误', '保存信息失败，请重试', 'exclamation-circle', 'red-500');
    }
});

// 姓名查询表单提交
nameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('query-name').value.trim();
    
    if (!name) {
        showToast('提示', '请输入姓名', 'info-circle');
        return;
    }
    
    try {
        const records = await fetchRecords(`name = '${name}'`);
        
        if (records.length === 0) {
            // 未找到记录
            nameInputSection.classList.add('hidden');
            resultSection.classList.remove('hidden');
            foundResult.classList.add('hidden');
            notFoundResult.classList.remove('hidden');
            wrongAnswerResult.classList.add('hidden');
        } else {
            // 找到记录，显示验证问题
            currentUserData = records[0];
            questionLabel.textContent = currentUserData.queryQuestion;
            answerInput.value = '';
            
            nameInputSection.classList.add('hidden');
            questionVerificationSection.classList.remove('hidden');
        }
    } catch (error) {
        console.error('查询失败:', error);
        showToast('错误', '查询失败，请重试', 'exclamation-circle', 'red-500');
    }
});

// 提交答案
submitAnswerBtn.addEventListener('click', () => {
    const answer = answerInput.value.trim();
    
    if (!answer) {
        showToast('提示', '请输入答案', 'info-circle');
        return;
    }
    
    if (currentUserData && answer.toLowerCase() === currentUserData.queryAnswer.toLowerCase()) {
        // 答案正确，显示结果
        resultName.textContent = currentUserData.name;
        resultSchool.textContent = currentUserData.school;
        resultYear.textContent = currentUserData.graduationYear;
        resultDestination.textContent = currentUserData.destination;
        
        questionVerificationSection.classList.add('hidden');
        resultSection.classList.remove('hidden');
        foundResult.classList.remove('hidden');
        notFoundResult.classList.add('hidden');
        wrongAnswerResult.classList.add('hidden');
    } else {
        // 答案错误
        questionVerificationSection.classList.add('hidden');
        resultSection.classList.remove('hidden');
        foundResult.classList.add('hidden');
        notFoundResult.classList.add('hidden');
        wrongAnswerResult.classList.remove('hidden');
    }
});

// 取消查询
cancelQueryBtn.addEventListener('click', resetQuery流程);

// 新的查询
newQueryBtn.addEventListener('click', resetQuery流程);

// 重置查询流程
function resetQuery流程() {
    document.getElementById('query-name').value = '';
    answerInput.value = '';
    currentUserData = null;
    
    nameInputSection.classList.remove('hidden');
    questionVerificationSection.classList.add('hidden');
    resultSection.classList.add('hidden');
}

// 数据操作函数 - Neon数据库交互
async function initializeDatabase() {
    if (!window.neon) {
        throw new Error('Neon插件未加载');
    }
    
    // 连接到Neon数据库
    const client = await window.neon.connect();
    
    // 创建表（如果不存在）
    await client.query(`
        CREATE TABLE IF NOT EXISTS graduates (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            school TEXT NOT NULL,
            graduation_year TEXT NOT NULL,
            destination TEXT NOT NULL,
            query_question TEXT NOT NULL,
            query_answer TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    return client;
}

async function saveRecord(data) {
    const client = await initializeDatabase();
    
    try {
        await client.query(`
            INSERT INTO graduates (
                name, school, graduation_year, destination, query_question, query_answer
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            data.name,
            data.school,
            data.graduationYear,
            data.destination,
            data.queryQuestion,
            data.queryAnswer
        ]);
    } finally {
        await client.end();
    }
}

async function fetchRecords(condition) {
    const client = await initializeDatabase();
    
    try {
        const query = condition 
            ? `SELECT * FROM graduates WHERE ${condition}`
            : 'SELECT * FROM graduates';
            
        const result = await client.query(query);
        
        // 转换为更友好的格式
        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            school: row.school,
            graduationYear: row.graduation_year,
            destination: row.destination,
            queryQuestion: row.query_question,
            queryAnswer: row.query_answer,
            createdAt: row.created_at
        }));
    } finally {
        await client.end();
    }
}

async function deleteRecords(condition) {
    if (!condition) {
        throw new Error('删除操作需要条件');
    }
    
    const client = await initializeDatabase();
    
    try {
        await client.query(`DELETE FROM graduates WHERE ${condition}`);
    } finally {
        await client.end();
    }
}
