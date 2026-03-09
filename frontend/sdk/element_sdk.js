/**
 * ScholarSwift Element SDK Mock
 * Simulates configuration and theming system for prototype
 */

window.elementSdk = (function() {
    let config = {};
    let configHandler = null;
    
    const init = (options) => {
        console.log('🎨 Element SDK initialized');
        
        const { defaultConfig, onConfigChange, mapToCapabilities, mapToEditPanelValues } = options;
        
        config = { ...defaultConfig };
        configHandler = onConfigChange;
        
        console.log('Default config:', config);
        
        return true;
    };
    
    const setConfig = async (newConfig) => {
        console.log('⚙️ Updating config:', newConfig);
        
        config = {
            ...config,
            ...newConfig
        };
        
        // Call handler if exists
        if (configHandler) {
            await configHandler(config);
        }
        
        return { isOk: true, data: config };
    };
    
    const getConfig = () => {
        return { ...config };
    };
    
    const resetConfig = async () => {
        console.log('🔄 Resetting config to default');
        config = {};
        return { isOk: true };
    };
    
    // Theme management
    const themes = {
        light: {
            primary_color: '#10b981',
            secondary_color: '#1e293b',
            text_color: '#1e293b',
            accent_color: '#8b5cf6',
            surface_color: '#ffffff'
        },
        dark: {
            primary_color: '#34d399',
            secondary_color: '#0f172a',
            text_color: '#f1f5f9',
            accent_color: '#a78bfa',
            surface_color: '#1e293b'
        }
    };
    
    const applyTheme = async (themeName) => {
        if (themes[themeName]) {
            await setConfig(themes[themeName]);
            return { isOk: true };
        }
        return { isOk: false, error: 'Theme not found' };
    };
    
    // Component registration
    const components = new Map();
    
    const registerComponent = (name, component) => {
        components.set(name, component);
        console.log(`📦 Component registered: ${name}`);
    };
    
    const getComponent = (name) => {
        return components.get(name);
    };
    
    // Public API
    return {
        init,
        setConfig,
        getConfig,
        resetConfig,
        applyTheme,
        registerComponent,
        getComponent,
        
        // Utility methods
        themes,
        version: '1.0.0'
    };
})();

console.log('✅ Element SDK loaded');