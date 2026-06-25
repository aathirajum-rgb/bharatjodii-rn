/**
 * Jodii Matrimony - Global Configuration
 */
const JODII_CONFIG = {
    // API Endpoints
    API_BASE_URL: 'https://stgoapi.jodii.app',
    CONFIG_JSON_URL: 'https://stgimg.jodii.app/pwa/js/config.json',
    
    // Success Story Endpoints
    SUCCESS_STORY_ENDPOINTS: {
        'en': 'https://jodii.matrimonycdn.com/jodii/success/story/jodii_1_en.json',
        'gj': 'https://jodii.matrimonycdn.com/jodii/success/story/jodii_5_gj.json',
        'hi': 'https://jodii.matrimonycdn.com/jodii/success/story/jodii_10_hi.json',
        'ta': 'https://jodii.matrimonycdn.com/jodii/success/story/jodii_1_tm.json',
        'te': 'https://jodii.matrimonycdn.com/jodii/success/story/jodii_2_tl.json',
        'kn': 'https://jodii.matrimonycdn.com/jodii/success/story/jodii_4_kn.json',
        'ml': 'https://jodii.matrimonycdn.com/jodii/success/story/jodii_3_ml.json',
        'mr': 'https://jodii.matrimonycdn.com/jodii/success/story/jodii_6_mt.json',
        'bn': 'https://jodii.matrimonycdn.com/jodii/success/story/jodii_7_bn.json',
        'or': 'https://jodii.matrimonycdn.com/jodii/success/story/jodii_12_or.json',
        'pa': 'https://jodii.matrimonycdn.com/jodii/success/story/jodii_8_pa.json',
    },
    
    // App Constants
    APP_TYPE: '600',
    APP_VERSION: '7.0',
    DEFAULT_LANG: 'en',
    
    // PWA Constants
    CACHE_NAME: 'jodii-pwa-v1'
};

// Export if using modules, otherwise it stays in global scope for legacy support
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JODII_CONFIG;
}
