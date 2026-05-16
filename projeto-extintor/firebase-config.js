// Firebase Configuration - Shared across all pages
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyAARuHXm_HqCT-CW7QZU-vBdfnIbXO10bs",
    authDomain: "projetobruno-91df6.firebaseapp.com",
    projectId: "projetobruno-91df6",
    storageBucket: "projetobruno-91df6.firebasestorage.app",
    messagingSenderId: "801742328850",
    appId: "1:801742328850:web:29a98b52a643587f0034cb",
    measurementId: "G-ES45MDSCCH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Try to initialize analytics (may fail in some environments)
try {
    const analytics = getAnalytics(app);
} catch (e) {
    console.log('Analytics not available in this environment');
}

// ==================== HELPER FUNCTIONS ====================

// Sanitize ID for Firestore (replace / with -)
function sanitizeId(id) {
    return id.replace(/\//g, '-');
}

// ==================== DATABASE FUNCTIONS ====================

// Get all items from Firestore
async function getAllItems() {
    const snapshot = await getDocs(collection(db, "extintores"));
    const items = {};
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Use original ID if available, otherwise use doc ID
        const displayId = data._originalId || docSnap.id;
        items[displayId] = data;
    });
    return items;
}

// Get a single item by ID
async function getItem(id) {
    // Try exact match first (sanitized)
    const safeId = sanitizeId(id);
    const docRef = doc(db, "extintores", safeId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        const displayId = data._originalId || docSnap.id;
        return { id: displayId, data };
    }
    
    // Try normalized search (remove spaces and slashes)
    const allItems = await getAllItems();
    const normalizedId = id.replace(/[\s/]/g, '');
    
    for (const [key, data] of Object.entries(allItems)) {
        if (key.trim() === id.trim() || key.replace(/[\s/]/g, '') === normalizedId) {
            return { id: key, data };
        }
    }
    
    return null;
}

// Update inspection data
async function updateInspection(id, updateData) {
    const safeId = sanitizeId(id);
    const docRef = doc(db, "extintores", safeId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
        return { success: false, message: 'Equipamento não encontrado.' };
    }
    
    const currentData = docSnap.data();
    const today = new Date();
    const dateStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    const newData = {
        ultima_inspecao: dateStr,
        status: updateData.status === 'Warning' ? 'Atenção' : 'OK'
    };
    
    if (updateData.states) {
        newData.states = updateData.states;
        
        // Handle responsaveis
        let responsaveis = currentData.responsaveis || {};
        const modifiedKeys = updateData.modifiedKeys || [];
        
        if (modifiedKeys.length > 0) {
            modifiedKeys.forEach(key => {
                responsaveis[key] = updateData.responsavel;
            });
        } else if (Object.keys(responsaveis).length === 0 && updateData.responsavel) {
            Object.keys(updateData.states).forEach(key => {
                responsaveis[key] = updateData.responsavel;
            });
        }
        
        newData.responsaveis = responsaveis;
        
        // Consolidate unique responsaveis
        const uniqueResp = [...new Set(Object.values(responsaveis))];
        newData.responsavel = uniqueResp.join(', ');
    }
    
    if (updateData.observation && updateData.observation.trim()) {
        newData.observacao = updateData.observation;
    } else {
        newData.observacao = null; // Will be removed
    }
    
    // Clean null fields
    const cleanData = {};
    for (const [key, val] of Object.entries(newData)) {
        if (val !== null && val !== undefined) {
            cleanData[key] = val;
        }
    }
    
    await updateDoc(docRef, cleanData);
    
    // Remove observacao field if null
    if (newData.observacao === null) {
        const { deleteField } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
        await updateDoc(docRef, { observacao: deleteField() });
    }
    
    return { success: true };
}

// Reset all inspections
async function resetAllInspections() {
    const snapshot = await getDocs(collection(db, "extintores"));
    const batch = writeBatch(db);
    const { deleteField } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    
    snapshot.forEach((docSnap) => {
        const ref = doc(db, "extintores", docSnap.id);
        batch.update(ref, {
            ultima_inspecao: 'Pendente',
            status: 'OK',
            responsavel: deleteField(),
            responsaveis: deleteField(),
            states: deleteField(),
            observacao: deleteField()
        });
    });
    
    await batch.commit();
    return { success: true };
}

// Seed Firestore with data from data.json
async function seedFirestore(data) {
    const batch = writeBatch(db);
    
    for (const [id, itemData] of Object.entries(data)) {
        const safeId = sanitizeId(id);
        const docRef = doc(db, "extintores", safeId);
        batch.set(docRef, itemData);
    }
    
    await batch.commit();
    return { success: true };
}

// Export functions
export { db, getAllItems, getItem, updateInspection, resetAllInspections, seedFirestore };
