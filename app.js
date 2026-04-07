// 天气应用主逻辑
// 使用 Open-Meteo API (免费，无需API Key)

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
                this.fetchWeatherByCoords(latitude, longitude);
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

    // 中国主要城市坐标数据库（用于提高搜索准确性）
    getChinaCityCoord(cityName) {
        const cityDB = {
            '北京': { lat: 39.9042, lon: 116.4074 },
            '上海': { lat: 31.2304, lon: 121.4737 },
            '广州': { lat: 23.1291, lon: 113.2644 },
            '深圳': { lat: 22.5431, lon: 114.0579 },
            '杭州': { lat: 30.2741, lon: 120.1551 },
            '南京': { lat: 32.0603, lon: 118.7969 },
            '成都': { lat: 30.5728, lon: 104.0668 },
            '重庆': { lat: 29.5630, lon: 106.5516 },
            '武汉': { lat: 30.5928, lon: 114.3055 },
            '西安': { lat: 34.3416, lon: 108.9398 },
            '苏州': { lat: 31.2989, lon: 120.5853 },
            '天津': { lat: 39.0842, lon: 117.2009 },
            '长沙': { lat: 28.2282, lon: 112.9388 },
            '郑州': { lat: 34.7466, lon: 113.6253 },
            '沈阳': { lat: 41.8057, lon: 123.4315 },
            '青岛': { lat: 36.0671, lon: 120.3826 },
            '宁波': { lat: 29.8683, lon: 121.5440 },
            '合肥': { lat: 31.8206, lon: 117.2272 },
            '佛山': { lat: 23.0218, lon: 113.1219 },
            '东莞': { lat: 23.0470, lon: 113.7490 },
            '昆明': { lat: 25.0389, lon: 102.7183 },
            '福州': { lat: 26.0745, lon: 119.2965 },
            '厦门': { lat: 24.4798, lon: 118.0894 },
            '哈尔滨': { lat: 45.8038, lon: 126.5349 },
            '长春': { lat: 43.8171, lon: 125.3235 },
            '石家庄': { lat: 38.0428, lon: 114.5149 },
            '南昌': { lat: 28.6820, lon: 115.8579 },
            '贵阳': { lat: 26.6470, lon: 106.6302 },
            '兰州': { lat: 36.0611, lon: 103.8343 },
            '海口': { lat: 20.0440, lon: 110.1999 },
            '乌鲁木齐': { lat: 43.8256, lon: 87.6168 },
            '拉萨': { lat: 29.6500, lon: 91.1000 },
            '银川': { lat: 38.4872, lon: 106.2309 },
            '西宁': { lat: 36.6171, lon: 101.7782 }
        };

        // 尝试匹配城市名（支持不带"市"后缀）
        const normalizedName = cityName.replace(/市$/, '');
        return cityDB[normalizedName] || cityDB[cityName] || null;
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
            // 首先尝试从中国城市数据库查找（更准确）
            const chinaCity = this.getChinaCityCoord(city);
            if (chinaCity) {
                await this.fetchWeatherByCoords(chinaCity.lat, chinaCity.lon, city, '中国');
                return;
            }

            // 如果数据库中没有，使用 Open-Meteo Geocoding API
            const response = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=zh&format=json`
            );
            const data = await response.json();

            if (!data.results || data.results.length === 0) {
                throw new Error('未找到该城市，请检查城市名称');
            }

            // 优先选择中国的城市
            const result = data.results.find(r => r.country === 'China' || r.country === '中国') || data.results[0];
            const { latitude, longitude, name, country } = result;

            // 获取天气数据
            await this.fetchWeatherByCoords(latitude, longitude, name, country);

        } catch (error) {
            this.hideLoading();
            this.showError(error.message || '查询失败，请稍后重试');
        }
    }

    // 根据坐标获取天气
    async fetchWeatherByCoords(lat, lon, cityName = null, country = null) {
        try {
            // 获取当前天气和预报
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`
            );

            if (!response.ok) {
                throw new Error('获取天气数据失败');
            }

            const data = await response.json();

            // 如果提供了城市名，使用提供的；否则需要通过反向地理编码获取
            let displayName = cityName;
            if (!displayName) {
                displayName = await this.getCityNameByCoords(lat, lon);
            }

            this.displayWeather(data, displayName, country);
            this.displayForecast(data.daily);

            this.hideLoading();
            this.showWeatherCard();

        } catch (error) {
            this.hideLoading();
            this.showError(error.message || '获取天气失败');
        }
    }

    // 根据坐标获取城市名
    async getCityNameByCoords(lat, lon) {
        try {
            // 使用 BigDataCloud 免费反向地理编码 API（无需API Key，有免费额度）
            const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`
            );
            const data = await response.json();
            if (data.city) {
                return data.city;
            } else if (data.locality) {
                return data.locality;
            }
        } catch (e) {
            console.log('反向地理编码失败:', e);
        }

        // 备用：直接使用经纬度作为位置名称
        return `当前位置 (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
    }

    // 显示天气数据
    displayWeather(data, cityName, country) {
        const current = data.current;

        document.getElementById('cityName').textContent = cityName + (country ? `, ${country}` : '');
        document.getElementById('updateTime').textContent = `更新时间：${new Date().toLocaleString('zh-CN')}`;
        document.getElementById('temp').textContent = Math.round(current.temperature_2m);
        document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;
        document.getElementById('windSpeed').textContent = `${current.wind_speed_10m} km/h`;
        document.getElementById('visibility').textContent = `${(current.visibility / 1000).toFixed(1)} km`;
        document.getElementById('feelsLike').textContent = `${Math.round(current.apparent_temperature)}°C`;

        // 天气描述和图标
        const weatherInfo = this.getWeatherInfo(current.weather_code);
        document.getElementById('weatherDesc').textContent = weatherInfo.desc;
        document.getElementById('weatherIcon').src = weatherInfo.icon;
    }

    // 显示未来预报
    displayForecast(daily) {
        const forecastList = document.getElementById('forecastList');
        forecastList.innerHTML = '';

        // 显示接下来3天（跳过今天）
        for (let i = 1; i <= 3; i++) {
            const date = new Date(daily.time[i]);
            const weatherInfo = this.getWeatherInfo(daily.weather_code[i]);
            const maxTemp = Math.round(daily.temperature_2m_max[i]);
            const minTemp = Math.round(daily.temperature_2m_min[i]);

            const item = document.createElement('div');
            item.className = 'forecast-item';
            item.innerHTML = `
                <p class="date">${date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })}</p>
                <img class="icon" src="${weatherInfo.icon}" alt="${weatherInfo.desc}">
                <p class="temp-range">${maxTemp}° / ${minTemp}°</p>
            `;
            forecastList.appendChild(item);
        }

        this.forecast.classList.remove('hidden');
    }

    // 获取天气图标和描述 (WMO Weather interpretation codes)
    getWeatherInfo(code) {
        const weatherMap = {
            0: { desc: '晴朗', icon: 'https://cdn-icons-png.flaticon.com/128/869/869869.png' },
            1: { desc: ' mainly clear', icon: 'https://cdn-icons-png.flaticon.com/128/1163/1163661.png' },
            2: { desc: '多云', icon: 'https://cdn-icons-png.flaticon.com/128/1163/1163661.png' },
            3: { desc: '阴天', icon: 'https://cdn-icons-png.flaticon.com/128/414/414927.png' },
            45: { desc: '雾', icon: 'https://cdn-icons-png.flaticon.com/128/4151/4151022.png' },
            48: { desc: '雾凇', icon: 'https://cdn-icons-png.flaticon.com/128/4151/4151022.png' },
            51: { desc: '毛毛雨', icon: 'https://cdn-icons-png.flaticon.com/128/414/414974.png' },
            53: { desc: '小雨', icon: 'https://cdn-icons-png.flaticon.com/128/414/414974.png' },
            55: { desc: '中雨', icon: 'https://cdn-icons-png.flaticon.com/128/414/414974.png' },
            61: { desc: '小雨', icon: 'https://cdn-icons-png.flaticon.com/128/1163/1163627.png' },
            63: { desc: '中雨', icon: 'https://cdn-icons-png.flaticon.com/128/1163/1163627.png' },
            65: { desc: '大雨', icon: 'https://cdn-icons-png.flaticon.com/128/1163/1163627.png' },
            71: { desc: '小雪', icon: 'https://cdn-icons-png.flaticon.com/128/642/642102.png' },
            73: { desc: '中雪', icon: 'https://cdn-icons-png.flaticon.com/128/642/642102.png' },
            75: { desc: '大雪', icon: 'https://cdn-icons-png.flaticon.com/128/642/642102.png' },
            80: { desc: '阵雨', icon: 'https://cdn-icons-png.flaticon.com/128/1163/1163627.png' },
            81: { desc: '阵雨', icon: 'https://cdn-icons-png.flaticon.com/128/1163/1163627.png' },
            82: { desc: '强阵雨', icon: 'https://cdn-icons-png.flaticon.com/128/1163/1163627.png' },
            95: { desc: '雷雨', icon: 'https://cdn-icons-png.flaticon.com/128/1146/1146869.png' },
            96: { desc: '雷雨伴冰雹', icon: 'https://cdn-icons-png.flaticon.com/128/1146/1146869.png' },
            99: { desc: '强雷雨伴冰雹', icon: 'https://cdn-icons-png.flaticon.com/128/1146/1146869.png' },
        };

        return weatherMap[code] || { desc: '未知', icon: 'https://cdn-icons-png.flaticon.com/128/1163/1163661.png' };
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
