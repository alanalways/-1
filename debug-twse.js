
import axios from 'axios';

const http = axios.create({
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

async function testTWSE() {
    console.log('Testing TWSE API...');
    try {
        const response = await http.get('https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&type=IND');

        console.log('Status:', response.status);
        if (response.data) {
            const keys = Object.keys(response.data);
            console.log('Response Keys:', keys);

            if (response.data.tables) {
                console.log('Tables count:', response.data.tables.length);
                let found = false;
                response.data.tables.forEach((t, i) => {
                    if (t.data) {
                        const targetRow = t.data.find(r => r[0] && r[0].includes('加權股價指數'));
                        if (targetRow) {
                            console.log(`FOUND in Table ${i}`);
                            console.log('Row data:', targetRow);
                            found = true;
                        }
                    }
                });
                if (!found) console.log('Not found in any table');
            } else if (response.data.data1) {
                console.log('data1 length:', response.data.data1.length);
                console.log('First 3 rows of data1:', response.data.data1.slice(0, 3));

                const indexData = response.data.data1.find(row => row[0].includes('加權股價指數'));
                console.log('Found Index Data:', indexData);
            } else {
                console.log('No data1 or tables found in response', response.data);
            }
        } else {
            console.log('No data in response');
        }
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
        }
    }
}

testTWSE();
