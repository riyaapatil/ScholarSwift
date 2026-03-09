/**
 * ScholarSwift Data SDK Mock
 * Simulates data persistence layer for prototype
 */

window.dataSdk = (function() {
    // In-memory storage
    let storage = [];
    let dataHandler = null;
    
    const init = async (handler) => {
        console.log('📊 Data SDK initialized');
        dataHandler = handler;
        
        // Load initial demo data
        storage = [
            {
                id: '1',
                type: 'booking',
                email: 'aarav@email.com',
                name: 'Aarav Sharma',
                department: 'DS',
                uniqueKey: 'DS-001',
                slotTime: '9:30 AM',
                slotDate: new Date().toISOString().split('T')[0],
                status: 'verified',
                tokenNumber: 1,
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                type: 'booking',
                email: 'priya@email.com',
                name: 'Priya Patel',
                department: 'DS',
                uniqueKey: 'DS-002',
                slotTime: '9:37 AM',
                slotDate: new Date().toISOString().split('T')[0],
                status: 'verified',
                tokenNumber: 2,
                createdAt: new Date().toISOString()
            }
        ];
        
        return { isOk: true, data: storage };
    };
    
    const create = async (data) => {
        console.log('📝 Creating record:', data);
        
        // Generate ID
        const id = Date.now().toString();
        const newRecord = {
            id,
            ...data
        };
        
        storage.push(newRecord);
        
        // Notify handler if exists
        if (dataHandler && dataHandler.onDataChanged) {
            dataHandler.onDataChanged(storage);
        }
        
        return { isOk: true, data: newRecord };
    };
    
    const read = async (id) => {
        const record = storage.find(item => item.id === id);
        return { isOk: true, data: record };
    };
    
    const update = async (id, data) => {
        console.log('📝 Updating record:', id, data);
        
        const index = storage.findIndex(item => item.id === id);
        if (index !== -1) {
            storage[index] = { ...storage[index], ...data };
            
            // Notify handler if exists
            if (dataHandler && dataHandler.onDataChanged) {
                dataHandler.onDataChanged(storage);
            }
            
            return { isOk: true, data: storage[index] };
        }
        
        return { isOk: false, error: 'Record not found' };
    };
    
    const remove = async (id) => {
        console.log('🗑️ Deleting record:', id);
        
        const index = storage.findIndex(item => item.id === id);
        if (index !== -1) {
            storage.splice(index, 1);
            
            // Notify handler if exists
            if (dataHandler && dataHandler.onDataChanged) {
                dataHandler.onDataChanged(storage);
            }
            
            return { isOk: true };
        }
        
        return { isOk: false, error: 'Record not found' };
    };
    
    const query = async (filter) => {
        let results = [...storage];
        
        if (filter) {
            Object.keys(filter).forEach(key => {
                results = results.filter(item => item[key] === filter[key]);
            });
        }
        
        return { isOk: true, data: results };
    };
    
    const clear = async () => {
        storage = [];
        return { isOk: true };
    };
    
    // Public API
    return {
        init,
        create,
        read,
        update,
        delete: remove,
        query,
        clear
    };
})();

console.log('✅ Data SDK loaded');