// 測試 TWSE API (使用 axios)
import axios from 'axios';

async function testTWSE() {
    try {
        const response = await axios.get('https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=open_data', {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const lines = response.data.split('\n');
        console.log('Total lines:', lines.length);
        console.log('Headers:', lines[0]);

        // 找 2330 台積電
        const tsmc = lines.find(l => l.includes('2330'));
        console.log('\n2330 台積電:');
        console.log(tsmc);

        // 解析 2330 資料
        if (tsmc) {
            const cols = tsmc.split(',');
            console.log('\n解析後：');
            console.log('代號:', cols[0]);
            console.log('名稱:', cols[1]);
            console.log('成交股數:', cols[2]);
            console.log('成交金額:', cols[3]);
            console.log('開盤價:', cols[4]);
            console.log('最高價:', cols[5]);
            console.log('最低價:', cols[6]);
            console.log('收盤價:', cols[7]);
            console.log('漲跌價差:', cols[8]);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testTWSE();
