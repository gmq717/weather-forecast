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
            // 使用 Open-Meteo Geocoding API 获取城市坐标
            const response = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`
            );
            const data = await response.json();

            if (!data.results || data.results.length === 0) {
                throw new Error('未找到该城市，请检查城市名称');
            }

            const result = data.results[0];
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
