// 天气应用主逻辑
// 使用和风天气商业版 API (通过 Header 传递 API Key)

// API 配置
const QWEATHER_API_KEY = '200463910e3740179a69e5467a497a47';
const QWEATHER_BASE_URL = 'https://nm4wcv3wv5.re.qweatherapi.com';

class WeatherApp {
    constructor() {
        this.initElements();
        this.bindEvents();
        this.autoLocate(); // 页面加载自动定位
    }

    // 初始化DOM元素
    initElements() {
        this.locateBtn = document.getElementById('locateBtn');
        this.cityInput = document.getElementById('cityInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.loading = document.getElementById('loading');
        this.error = document.getElementById('error');
        this.errorMessage = document.getElementById('errorMessage');
        this.weatherCard = document.getElementById('weatherCard');
        this.forecast = document.getElementById('forecast');
        this.forecastList = document.getElementById('forecastList');
    }

    // 绑定事件
    bindEvents() {
        this.locateBtn.addEventListener('click', () => this.getLocation());
        this.searchBtn.addEventListener('click', () => this.searchCity());
        this.cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchCity();
        });
    }

    // 页面加载自动定位（静默失败）
    autoLocate() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    this.fetchWeatherByCoords(latitude, longitude, '当前位置');
                },
                () => {
                    // 自动定位失败不显示错误，让用户手动搜索
                    console.log('自动定位失败，等待用户手动操作');
                },
                { timeout: 3000 }
            );
        }
    }

    // 获取当前位置
    getLocation() {
        this.showLoading();
        this.hideError();

        if (!navigator.geolocation) {
            this.showError('您的浏览器不支持地理定位功能');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.fetchWeatherByCoords(latitude, longitude, '当前位置');
            },
            (error) => {
                this.hideLoading();
                let message = '获取位置失败';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        message = '请允许获取您的位置信息';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = '位置信息不可用';
                        break;
                    case error.TIMEOUT:
                        message = '获取位置超时';
                        break;
                }
                this.showError(message);
            }
        );
    }

    // 搜索城市
    async searchCity() {
        const city = this.cityInput.value.trim();
        if (!city) {
            this.showError('请输入城市名称');
            return;
        }

        this.showLoading();
        this.hideError();

        try {
            // 使用和风天气 GeoAPI 搜索城市，支持城市名称和城市代码
            const locationParam = /^\d+$/.test(city) ? city : encodeURIComponent(city);
            const url = `${QWEATHER_BASE_URL}/geo/v2/city/lookup?location=${locationParam}&lang=zh&number=1`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-QW-Api-Key': QWEATHER_API_KEY,
                    'Accept-Encoding': 'gzip, deflate'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }

            const data = await response.json();

            if (data.code !== '200' || !data.location || data.location.length === 0) {
                throw new Error('未找到该城市，请检查城市名称');
            }

            // 获取第一个匹配的城市
            const location = data.location[0];
            const { lat, lon, name, adm1, country } = location;
            const displayName = adm1 && adm1 !== name ? `${adm1} ${name}` : name;

            // 获取天气数据
            await this.fetchWeatherByCoords(parseFloat(lat), parseFloat(lon), displayName, country);

            // 搜索成功后清空输入框并失焦
            this.cityInput.value = '';
            this.cityInput.blur();

        } catch (error) {
            console.error('搜索城市时出错:', error);
            this.hideLoading();
            this.showError(error.message || '查询失败，请检查网络连接或稍后重试');
        }
    }

    // 根据坐标获取天气
    async fetchWeatherByCoords(lat, lon, cityName, country = '') {
        try {
            // 使用和风天气实时天气 API
            const url = `${QWEATHER_BASE_URL}/v7/weather/now?location=${lon},${lat}&lang=zh`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-QW-Api-Key': QWEATHER_API_KEY,
                    'Accept-Encoding': 'gzip, deflate'
                }
            });

            if (!response.ok) {
                throw new Error(`天气API请求失败: ${response.status}`);
            }

            const data = await response.json();

            if (data.code !== '200') {
                throw new Error(`获取天气失败: ${data.message || '未知错误'}`);
            }

            // 获取预报数据
            await this.fetchForecast(lat, lon);

            // 显示天气数据
            this.displayWeather(data.now, cityName, country);
            // 设置动态背景色
            this.updateBackground(data.now.icon);

            this.hideLoading();
            this.showWeatherCard();

        } catch (error) {
            console.error('获取天气时出错:', error);
            this.hideLoading();
            this.showError(error.message || '获取天气失败，请稍后重试');
        }
    }

    // 获取天气预报
    async fetchForecast(lat, lon) {
        try {
            const url = `${QWEATHER_BASE_URL}/v7/weather/3d?location=${lon},${lat}&lang=zh`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-QW-Api-Key': QWEATHER_API_KEY,
                    'Accept-Encoding': 'gzip, deflate'
                }
            });

            if (!response.ok) return;

            const data = await response.json();

            if (data.code === '200' && data.daily) {
                this.displayForecast(data.daily);
            }
        } catch (e) {
            console.log('获取预报失败:', e);
        }
    }

    // 天气图标映射
    getWeatherEmoji(iconCode) {
        const emojiMap = {
            // 晴
            '100': '☀️',
            '150': '🌙',
            // 多云
            '101': '⛅',
            '102': '🌤️',
            '103': '🌥️',
            '153': '☁️',
            // 阴
            '104': '☁️',
            // 阵雨
            '300': '🌦️',
            '301': '🌧️',
            '302': '⛈️',
            '303': '⛈️',
            '304': '⛈️',
            // 雷阵雨
            '305': '🌩️',
            '306': '⛈️',
            '307': '⛈️',
            '308': '⛈️',
            '309': '🌧️',
            '310': '🌧️',
            '311': '🌧️',
            '312': '🌧️',
            '313': '🌧️',
            '314': '🌧️',
            '315': '🌧️',
            '316': '🌧️',
            '317': '🌧️',
            '318': '🌧️',
            // 雨
            '350': '🌦️',
            '351': '🌦️',
            '399': '🌧️',
            // 雪
            '400': '❄️',
            '401': '🌨️',
            '402': '❄️',
            '403': '❄️',
            '404': '🌨️',
            '405': '🌨️',
            '406': '🌨️',
            '407': '🌨️',
            '408': '🌨️',
            '409': '🌨️',
            '410': '❄️',
            '499': '❄️',
            // 浮尘雾霾
            '500': '🌫️',
            '501': '🌫️',
            '502': '🌫️',
            '503': '🌫️',
            '504': '🌫️',
            '507': '🌪️',
            '508': '🌪️',
            '509': '🌫️',
            '510': '🌫️',
            '511': '🌫️',
            '512': '🌫️',
            '513': '🌫️',
            '514': '🌫️',
            '515': '🌫️',
            '599': '🌫️'
        };
        return emojiMap[iconCode] || '🌤️';
    }

    // 显示天气数据
    displayWeather(now, cityName, country) {
        document.getElementById('cityName').textContent = cityName + (country ? `, ${country}` : '');
        document.getElementById('updateTime').textContent = `更新时间：${new Date().toLocaleString('zh-CN')}`;
        document.getElementById('temp').textContent = now.temp;
        document.getElementById('humidity').textContent = `${now.humidity}%`;
        document.getElementById('windSpeed').textContent = `${now.windSpeed} km/h`;
        document.getElementById('visibility').textContent = now.vis ? `${(now.vis / 1000).toFixed(1)} km` : '-';
        document.getElementById('feelsLike').textContent = `${now.feelsLike}°C`;

        // 天气描述和图标（使用emoji，无需外部资源）
        document.getElementById('weatherDesc').textContent = now.text || '-';
        document.getElementById('weatherIcon').style.display = 'none'; // 隐藏原图片标签
        // 直接在描述前显示emoji
        document.getElementById('weatherDesc').innerHTML = `${this.getWeatherEmoji(now.icon)} ${now.text || '-'}`;
    }

    // 显示未来预报
    displayForecast(daily) {
        const forecastList = document.getElementById('forecastList');
        forecastList.innerHTML = '';

        // 显示3天预报
        daily.forEach((day) => {
            const date = new Date(day.fxDate);

            const item = document.createElement('div');
            item.className = 'forecast-item';
            item.innerHTML = `
                <p class="date">${date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })}</p>
                <p class="icon-emoji">${this.getWeatherEmoji(day.iconDay)}</p>
                <p class="temp-range">${day.tempMax}° / ${day.tempMin}°</p>
            `;
            forecastList.appendChild(item);
        });

        this.forecast.classList.remove('hidden');
    }

    // 根据天气图标更新背景色
    updateBackground(iconCode) {
        const body = document.body;
        const gradients = {
            // 晴天 (蓝色渐变)
            '100': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '150': 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', // 夜晚
            // 多云 (蓝紫渐变)
            '101': 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
            '102': 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
            '103': 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
            '153': 'linear-gradient(135deg, #2d3436 0%, #636e72 100%)', // 夜晚多云
            // 阴天 (灰蓝渐变)
            '104': 'linear-gradient(135deg, #636e72 0%, #b2bec3 100%)',
            // 雨天 (深灰蓝渐变)
            '300': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '301': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '302': 'linear-gradient(135deg, #1e3799 0%, #3c6382 100%)',
            '303': 'linear-gradient(135deg, #1e3799 0%, #3c6382 100%)',
            '304': 'linear-gradient(135deg, #1e3799 0%, #3c6382 100%)',
            '305': 'linear-gradient(135deg, #1e3799 0%, #3c6382 100%)',
            '306': 'linear-gradient(135deg, #1e3799 0%, #3c6382 100%)',
            '307': 'linear-gradient(135deg, #1e3799 0%, #3c6382 100%)',
            '308': 'linear-gradient(135deg, #1e3799 0%, #3c6382 100%)',
            '309': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '310': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '311': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '312': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '313': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '314': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '315': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '316': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '317': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '318': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '350': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '351': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            '399': 'linear-gradient(135deg, #4a69bd 0%, #6a89cc 100%)',
            // 雪天 (浅蓝白渐变)
            '400': 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
            '401': 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
            '402': 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
            '403': 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
            '404': 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
            '405': 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
            '406': 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
            '407': 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
            '408': 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
            '409': 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
            '410': 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
            '499': 'linear-gradient(135deg, #81ecec 0%, #74b9ff 100%)',
            // 雾霾 (灰黄渐变)
            '500': 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)',
            '501': 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)',
            '502': 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)',
            '503': 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)',
            '504': 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)',
            '507': 'linear-gradient(135deg, #2d3436 0%, #636e72 100%)',
            '508': 'linear-gradient(135deg, #2d3436 0%, #636e72 100%)',
            '509': 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)',
            '510': 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)',
            '511': 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)',
            '512': 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)',
            '513': 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)',
            '514': 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)',
            '515': 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)',
            '599': 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)'
        };

        const defaultGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        body.style.background = gradients[iconCode] || defaultGradient;
        body.style.backgroundAttachment = 'fixed';
        body.style.minHeight = '100vh';
    }

    // 显示/隐藏控制
    showLoading() {
        this.loading.classList.remove('hidden');
        this.weatherCard.classList.add('hidden');
        this.forecast.classList.add('hidden');
    }

    hideLoading() {
        this.loading.classList.add('hidden');
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.error.classList.remove('hidden');
    }

    hideError() {
        this.error.classList.add('hidden');
    }

    showWeatherCard() {
        this.weatherCard.classList.remove('hidden');
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});
