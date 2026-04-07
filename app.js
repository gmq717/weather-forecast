// 天气应用主逻辑
// 使用和风天气商业版 API (通过 Header 传递 API Key)

// API 配置
const QWEATHER_API_KEY = '200463910e3740179a69e5467a497a47';
const QWEATHER_BASE_URL = 'https://nm4wcv3wv5.re.qweatherapi.com';

class WeatherApp {
    constructor() {
        this.initElements();
        this.bindEvents();
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
            // 使用和风天气 GeoAPI 搜索城市
            const url = `${QWEATHER_BASE_URL}/geo/v2/city/lookup?location=${encodeURIComponent(city)}&lang=zh`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-QW-Api-Key': QWEATHER_API_KEY,
                    'Accept-Encoding': 'gzip, deflate'
                }
            });

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

    // 显示天气数据
    displayWeather(now, cityName, country) {
        document.getElementById('cityName').textContent = cityName + (country ? `, ${country}` : '');
        document.getElementById('updateTime').textContent = `更新时间：${new Date().toLocaleString('zh-CN')}`;
        document.getElementById('temp').textContent = now.temp;
        document.getElementById('humidity').textContent = `${now.humidity}%`;
        document.getElementById('windSpeed').textContent = `${now.windSpeed} km/h`;
        document.getElementById('visibility').textContent = now.vis ? `${(now.vis / 1000).toFixed(1)} km` : '-';
        document.getElementById('feelsLike').textContent = `${now.feelsLike}°C`;

        // 天气描述和图标
        document.getElementById('weatherDesc').textContent = now.text || '-';
        const weatherIcon = document.getElementById('weatherIcon');
        weatherIcon.src = `https://cdn.heweather.com/cond_icon/${now.icon}.png`;
        weatherIcon.onerror = function() {
            this.src = `https://dev.qweather.com/images/icons/${now.icon}.png`;
        };
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
                <img class="icon" src="https://cdn.heweather.com/cond_icon/${day.iconDay}.png" alt="${day.textDay}" onerror="this.onerror=null;this.src='https://dev.qweather.com/images/icons/${day.iconDay}.png'">
                <p class="temp-range">${day.tempMax}° / ${day.tempMin}°</p>
            `;
            forecastList.appendChild(item);
        });

        this.forecast.classList.remove('hidden');
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
