import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, Search, Edit2, Trash2, Tag, Utensils, IndianRupee, 
    Image as ImageIcon, CheckCircle2, XCircle, ChevronRight, 
    MoreVertical, Filter, Save, X, AlertTriangle, Building2, 
    Layers, Coffee, Pizza, Beef, PlusCircle, MinusCircle, 
    Loader2, ScanBarcode, History, WifiOff, Package 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logInventoryChange } from '../lib/inventory';
import InventoryKardex from './InventoryKardex';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { db } from '../lib/db';
import { OfflineManager } from '../services/OfflineManager';

const MenuManagement = () => {
    const { user } = useAuth();
    const organizationId = user?.organization_id || null;
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const { isOnline } = useOfflineSync();

    const [activeCategory, setActiveCategory] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showProductModal, setShowProductModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);
    const [selectedBranchForPrice, setSelectedBranchForPrice] = useState('Global');
    const [showKardexFor, setShowKardexFor] = useState(null);

    const [tempIngredients, setTempIngredients] = useState([]);
    const [tempExtras, setTempExtras] = useState([]);

    const fetchData = React.useCallback(async () => {
        if (!organizationId) return;
        setLoading(true);
        try {
            let cats, prods;
            if (isOnline) {
                const { data: c } = await supabase.from('categories').select('*').eq('organization_id', organizationId).order('id');
                cats = c;
            } else {
                cats = await db.categories.where('organization_id').equals(organizationId).toArray();
            }
            
            if (isOnline) {
                const { data: p } = await supabase.from('products').select('*').eq('organization_id', organizationId).order('id');
                prods = p;
                
                // Cache (Background)
                try {
                    if (cats) await db.categories.bulkPut(cats);
                    if (prods) await db.products.bulkPut(prods);
                } catch (dexieError) {
                    console.warn('[Menu] ⚠️ Fallo al actualizar caché local:', dexieError);
                }
            } else {
                prods = await db.products.where('organization_id').equals(organizationId).toArray();
            }

            if (cats) {
                setCategories(cats);
                setActiveCategory(prev => {
                    if (prev && cats.find(c => c.id == prev)) return prev;
                    return cats.length > 0 ? cats[0].id : null;
                });
            }
            if (prods) setProducts(prods);
        } catch (error) {
            console.error("Error loading inventory, checking local DB:", error);
            const c = await db.categories.where('organization_id').equals(organizationId).toArray();
            const p = await db.products.where('organization_id').equals(organizationId).toArray();
            setCategories(c);
            setProducts(p);
        } finally {
            setLoading(false);
        }
    }, [organizationId, isOnline]);

    // Cargar datos iniciales
    useEffect(() => {
        if (organizationId) {
            fetchData();

            // Suscripción Realtime (filtrado por canal si es posible, o recarga total)
            const categoryChannel = supabase.channel(`cat-changes-${organizationId}`)
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'categories',
                    filter: `organization_id=eq.${organizationId}`
                }, fetchData)
                .subscribe();

            const productChannel = supabase.channel(`prod-changes-${organizationId}`)
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'products',
                    filter: `organization_id=eq.${organizationId}`
                }, fetchData)
                .subscribe();

            return () => {
                supabase.removeChannel(categoryChannel);
                supabase.removeChannel(productChannel);
            };
        }
    }, [organizationId, fetchData]);

    const CATEGORY_EMOJIS = [
        '🍔', '🍟', '🍕', '🌭', '🌮', '🌯', '🥙', '🥗', '🍝', '🍜',
        '🍲', '🍱', '🍛', '🍣', '🍤', '🍗', '🍖', '🥓', '🥩', '🍔',
        '🥤', '🍺', '🍻', '🍷', '🍸', '🍹', '🍾', '🧃', '☕', '🍵',
        '🧁', '🍰', '🎂', '🍮', '🍪', '🍩', '🍨', '🍧', '🥧', '🍫'
    ];

    // --- MANEJO DE ESTADO LOCAL DEL MODAL ---
    const handleAddIngredient = (val) => {
        if (!val) return;
        setTempIngredients([...tempIngredients, val]);
    };

    const handleAddExtra = (name, price) => {
        if (!name || !price) return;
        setTempExtras([...tempExtras, { name, price: parseInt(price) }]);
    };

    const handleEditProduct = (product) => {
        setEditingProduct(product);
        setTempIngredients(product?.base_ingredients || []);
        setTempExtras(product?.extras || []);
        setShowProductModal(true);
    };

    const handleEditCategory = (category) => {
        setEditingCategory(category);
        setShowCategoryModal(true);
    };

    // --- FILTRADO ---
    const filteredProducts = products.filter(p =>
        p.category_id == activeCategory &&
        (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (p.barcode && p.barcode.includes(searchTerm)))
    );

    // --- DB ACTIONS ---

    const toggleAvailability = async (productId) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        // Actualización Optimista
        const newStatus = !product.available;
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, available: newStatus } : p));

        try {
            const { error } = await supabase
                .from('products')
                .update({ available: newStatus })
                .eq('id', productId);

            if (error) throw error;
        } catch (error) {
            // Revertir si falla
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, available: !newStatus } : p));
            alert("Error actualizando: " + error.message);
        }
    };

    const handleDeleteProduct = async (productId) => {
        if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;

        const previousProducts = [...products];
        setProducts(prev => prev.filter(p => p.id !== productId));

        try {
            const { error: deleteError } = await supabase.from('products').delete().eq('id', productId);
            
            if (deleteError) {
                // Error de llave foránea (ya tiene órdenes)
                if (deleteError.message.includes('violates foreign key constraint')) {
                    setProducts(previousProducts); // El producto vuelve a aparecer
                    if (window.confirm('No se puede eliminar el producto porque tiene órdenes registradas en el historial. ¿Deseas desactivarlo y marcarlo como "Agotado" para que no aparezca en pantalla, manteniendo la integridad del historial?')) {
                        await toggleAvailability(productId);
                    }
                    return;
                }
                throw deleteError;
            }
        } catch (error) {
            setProducts(previousProducts);
            alert("Error eliminando: " + error.message);
        }
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const name = formData.get('categoryName');
        const icon = formData.get('categoryIcon');

        if (!name || !icon) {
            alert('Por favor completa todos los campos');
            return;
        }

        // Optimistic UI
        const previousCategories = [...categories];
        const tempId = editingCategory ? editingCategory.id : `temp-${Date.now()}`;

        if (editingCategory) {
            setCategories(prev => prev.map(c => c.id == tempId ? { ...c, name, icon } : c));
        } else {
            setCategories(prev => [...prev, { id: tempId, name, icon }]);
        }

        // Cerrar modal inmediatamente para sensación de rapidez
        setShowCategoryModal(false);
        setEditingCategory(null);

        let error;
        try {
            if (editingCategory) {
                const { error: err } = await supabase
                    .from('categories')
                    .update({ name, icon })
                    .eq('id', editingCategory.id)
                    .select();
                error = err;
            } else {
                const { error: err } = await supabase
                    .from('categories')
                    .insert([{ name, icon, organization_id: organizationId }]);
                error = err;
            }

            if (error) throw error;
            // No necesitamos hacer nada si éxito, el Realtime traerá la data final confirmada
        } catch (err) {
            setCategories(previousCategories); // Revertir
            alert("Error guardando categoría: " + err.message);
        }
    };

    const handleDeleteCategory = async (categoryId) => {
        const productsInCategory = products.filter(p => p.category_id === categoryId);

        if (productsInCategory.length > 0) {
            if (!window.confirm(`Esta categoría tiene ${productsInCategory.length} producto(s). Los productos serán eliminados también (Cascade) o necesitas moverlos manualmente. ¿Continuar?`)) {
                return;
            }
        } else {
            if (!window.confirm('¿Eliminar categoría?')) return;
        }

        // Optimistic UI
        const previousCategories = [...categories];
        setCategories(prev => prev.filter(c => c.id !== categoryId));
        if (activeCategory === categoryId) setActiveCategory(null);

        try {
            const { error } = await supabase.from('categories').delete().eq('id', categoryId);
            if (error) {
                if (error.message.includes('foreign key')) {
                    throw new Error('No se puede eliminar la categoría porque tiene productos asignados. Mueve los productos a otra categoría primero.');
                }
                throw error;
            }
        } catch (error) {
            setCategories(previousCategories);
            alert("Error eliminando categoría: " + error.message);
        }
    };

    const handleSaveProduct = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const name = formData.get('productName');
        const price = parseFloat(formData.get('productPrice'));
        const categoryId = parseInt(formData.get('productCategory') || activeCategory);
        const stock = parseInt(formData.get('productStock') || 0);
        const stockThreshold = parseInt(formData.get('productStockThreshold') || 5);
        const image = formData.get('productImage');
        const description = formData.get('productDescription') || '';
        const barcode = formData.get('productBarcode') || '';

        // Precios por sede
        const branchPrices = {
            'Sede Norte': parseFloat(formData.get('priceSede Norte') || price),
            'Sede Sur': parseFloat(formData.get('priceSede Sur') || price),
            'Sede Centro': parseFloat(formData.get('priceSede Centro') || price)
        };

        if (!name || !price) {
            alert('Por favor completa los campos requeridos (Nombre y Precio)');
            return;
        }

        const productData = {
            name,
            price,
            category_id: categoryId, // Note: DB uses snake_case
            description,
            barcode,
            stock,
            stock_threshold: stockThreshold,
            branch_prices: branchPrices,
            base_ingredients: tempIngredients,
            extras: tempExtras,
            image: image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
            available: editingProduct ? editingProduct.available : true,
            organization_id: organizationId
        };

        // Optimistic UI Update
        const previousProducts = [...products];
        const tempProduct = {
            id: editingProduct ? editingProduct.id : `temp-${Date.now()}`,
            ...productData
        };

        if (editingProduct) {
            setProducts(prev => prev.map(p => p.id == editingProduct.id ? tempProduct : p));
        } else {
            setProducts(prev => [...prev, tempProduct]);
        }

        // Close modal immediately
        setShowProductModal(false);
        setEditingProduct(null);
        setTempIngredients([]);
        setTempExtras([]);

        let error;
        try {
            if (editingProduct) {
                const { error: err } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', editingProduct.id)
                    .select();
                error = err;
            } else {
                const { data: inserted, error: err } = await supabase
                    .from('products')
                    .insert([productData])
                    .select()
                    .single();
                
                if (inserted) {
                    setProducts(prev => prev.map(p => p.id === tempProduct.id ? inserted : p));
                }
                error = err;
            }

            if (error) throw error;

            // Log de Inventario si se cambió el stock manualmente
            const newStockVal = stock;
            const prevStockVal = editingProduct?.stock || 0;
            if (editingProduct && prevStockVal !== newStockVal) {
                await logInventoryChange({
                    productId: editingProduct.id,
                    branchId: user?.branch_id,
                    quantityChanged: newStockVal - prevStockVal,
                    newStock: newStockVal,
                    reason: 'ajuste',
                    userId: user?.id
                });
            } else if (!editingProduct && newStockVal > 0) {
                const { data: created } = await supabase
                    .from('products')
                    .select('id')
                    .eq('name', name)
                    .eq('organization_id', organizationId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (created) {
                    await logInventoryChange({
                        productId: created.id,
                        branchId: user?.branch_id,
                        quantityChanged: newStockVal,
                        newStock: newStockVal,
                        reason: 'ajuste',
                        userId: user?.id
                    });
                }
            }
        } catch (err) {
            setProducts(previousProducts); // Revert
            alert("Error guardando producto: " + err.message);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary" size={48} /></div>;

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">
            {/* Header con Buscador y Acción Principal */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar en esta categoría..."
                        className="w-full pl-12 pr-4 py-3 bg-surface-soft border border-hairline rounded-[16px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-[13px] font-bold"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex items-center bg-surface-soft border border-hairline rounded-full px-5 py-3 shadow-sm hover:shadow-airbnb transition-all">
                        <Building2 size={16} className="text-accent mr-2" />
                        <select
                            className="bg-transparent text-[11px] font-bold uppercase tracking-widest text-secondary focus:outline-none appearance-none pr-4 cursor-pointer"
                            value={selectedBranchForPrice}
                            onChange={(e) => setSelectedBranchForPrice(e.target.value)}
                        >
                            <option value="Global">Precio Global</option>
                            <option value="Sede Norte">Sede Norte</option>
                            <option value="Sede Sur">Sede Sur</option>
                            <option value="Sede Centro">Sede Centro</option>
                        </select>
                    </div>
                    <button
                        onClick={() => { setEditingProduct(null); setTempIngredients([]); setTempExtras([]); setShowProductModal(true); }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-secondary text-white px-8 py-3.5 rounded-full font-bold text-[11px] uppercase tracking-widest shadow-airbnb hover:shadow-premium active:scale-95 transition-all"
                    >
                        <Plus size={18} />
                        Nuevo Producto
                    </button>
                </div>
            </div>

            {categories.length === 0 ? (
                <div className="text-center py-24 bg-canvas rounded-[24px] border border-hairline shadow-sm">
                    <Utensils className="mx-auto text-accent/20 mb-6" size={64} />
                    <p className="text-accent font-bold uppercase tracking-widest text-[13px] mb-8">No hay categorías configuradas</p>
                    <button
                        onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                        className="inline-flex items-center gap-2 bg-secondary text-white px-8 py-3.5 rounded-full font-bold text-[11px] uppercase tracking-widest shadow-airbnb"
                    >
                        <Plus size={18} /> Crear Categoría
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Lateral: Categorías */}
                    <aside className="lg:col-span-1 space-y-5">
                        <div className="flex justify-between items-center px-4">
                            <h3 className="text-[11px] font-bold uppercase tracking-widest text-accent">Categorías</h3>
                            <button
                                onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                                className="text-primary hover:bg-primary/10 p-2 rounded-full transition-all"
                                title="Nueva Categoría"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                        <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-3 pb-4 lg:pb-0 scrollbar-hide">
                            {categories.map((cat) => (
                                <div
                                    key={cat.id}
                                    className={`flex items-center gap-4 px-6 py-4 rounded-[20px] font-bold text-[13px] whitespace-nowrap transition-all group cursor-pointer border ${activeCategory === cat.id
                                        ? 'bg-secondary text-white border-secondary shadow-airbnb translate-x-1'
                                        : 'bg-canvas text-secondary border-hairline hover:bg-surface-soft hover:shadow-sm'
                                        }`}
                                    onClick={() => setActiveCategory(cat.id)}
                                >
                                    <span className="text-2xl">{cat.icon}</span>
                                    <span className="flex-1">{cat.name}</span>
                                    
                                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }}
                                            className={`p-1.5 rounded-full transition-all ${activeCategory === cat.id ? 'hover:bg-white/20' : 'hover:bg-black/5'}`}
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                                            className={`p-1.5 rounded-full transition-all ${activeCategory === cat.id ? 'hover:bg-danger/20' : 'hover:bg-danger/5 hover:text-danger'}`}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    {activeCategory === cat.id && <ChevronRight className="ml-2 hidden lg:block" size={16} />}
                                </div>
                            ))}
                        </div>
                    </aside>

                    {/* Grid de Productos */}
                    <main className="lg:col-span-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredProducts.map((product) => {
                                const currentPrice = selectedBranchForPrice === 'Global'
                                    ? product.price
                                    : (product.branch_prices?.[selectedBranchForPrice] || product.price);

                                const isLowStock = product.stock <= product.stock_threshold;

                                return (
                                    <div
                                        key={product.id}
                                        className={`bg-canvas rounded-[24px] border border-hairline shadow-sm overflow-hidden group hover:shadow-airbnb transition-all duration-300 relative ${!product.available ? 'grayscale-[0.5] opacity-70' : ''}`}
                                    >
                                        {/* Imagen y Badge de Disponibilidad */}
                                        <div className="relative h-48 overflow-hidden">
                                            <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                            <div className="absolute top-4 right-4 flex flex-col gap-2">
                                                <button
                                                    onClick={() => toggleAvailability(product.id)}
                                                    className={`p-2.5 rounded-full backdrop-blur-md shadow-lg transition-all ${product.available ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}
                                                    title={product.available ? 'Disponible' : 'Agotado'}
                                                >
                                                    {product.available ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                                                </button>
                                                {isLowStock && product.available && (
                                                    <div className="p-2.5 rounded-full backdrop-blur-md bg-warning/20 text-warning shadow-lg animate-pulse" title="Stock Bajo">
                                                        <AlertTriangle size={18} />
                                                    </div>
                                                )}
                                            </div>
                                            {!product.available && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                    <span className="bg-white/90 text-secondary px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">Agotado</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Detalles */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-secondary text-lg leading-tight truncate group-hover:text-primary transition-colors">{product.name}</h4>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${isLowStock ? 'bg-danger/5 text-danger border-danger/10' : 'bg-surface-soft text-accent border-hairline'}`}>
                                                            Stock: {product.stock}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="font-bold text-secondary text-lg">${currentPrice.toLocaleString()}</span>
                                                    <p className="text-[9px] font-bold uppercase text-accent tracking-widest mt-0.5">{selectedBranchForPrice}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-1.5 h-6 overflow-hidden">
                                                {(product.base_ingredients || []).slice(0, 3).map((ing, i) => (
                                                    <span key={i} className="text-[9px] bg-surface-soft text-accent px-2 py-0.5 rounded-full border border-hairline font-bold uppercase tracking-widest">{ing}</span>
                                                ))}
                                                {(product.base_ingredients?.length > 3) && <span className="text-[9px] text-accent font-bold">+{product.base_ingredients.length - 3}</span>}
                                            </div>

                                            <div className="pt-5 flex items-center justify-between border-t border-hairline">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleEditProduct(product)}
                                                        className="p-2.5 bg-surface-soft text-accent hover:text-secondary hover:bg-gray-100 rounded-full transition-all border border-hairline"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteProduct(product.id)}
                                                        className="p-2.5 bg-surface-soft text-accent hover:text-danger hover:bg-danger/5 rounded-full transition-all border border-hairline"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setShowKardexFor(product)}
                                                        className="p-2.5 bg-surface-soft text-accent hover:text-primary hover:bg-primary/5 rounded-full transition-all border border-hairline"
                                                        title="Ver Historial (Kardex)"
                                                    >
                                                        <History size={16} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-accent tracking-widest">
                                                    <PlusCircle size={14} className="text-success" />
                                                    <span>{product.extras?.length || 0} extras</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {filteredProducts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 bg-surface-soft rounded-[24px] border border-hairline border-dashed">
                                <Utensils className="text-accent/20 mb-6" size={64} />
                                <p className="text-accent font-bold uppercase tracking-widest text-[13px]">No hay productos en esta categoría</p>
                            </div>
                        )}

                    </main>
                </div>
            )}

            {/* Modal para Crear/Editar Producto */}
            {showProductModal && (
                <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 overflow-hidden">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-canvas rounded-[24px] shadow-airbnb w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-hairline"
                    >
                        {/* Header Premium */}
                        <div className="bg-secondary p-8 text-white relative overflow-hidden flex-shrink-0">
                            <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                                            <Utensils size={18} className="text-white" />
                                        </div>
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">Catálogo Maestro</span>
                                    </div>
                                    <h3 className="text-2xl font-bold tracking-tight">
                                        {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                                    </h3>
                                    <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                                        <Layers size={12} /> Configuración avanzada de ingredientes y existencias
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setShowProductModal(false)} 
                                    className="p-2 hover:bg-white/10 rounded-full transition-all group active:scale-90"
                                >
                                    <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                                </button>
                            </div>
                        </div>

                        {/* Contenido con Scroll Moderno */}
                        <form key={editingProduct?.id || 'new'} onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto custom-scrollbar p-0">
                            <div className="grid grid-cols-1 lg:grid-cols-12">
                                
                                {/* Columna Izquierda: Configuración Principal */}
                                <div className="lg:col-span-7 p-8 space-y-8 border-r border-hairline">
                                    
                                    {/* Sección: Identidad */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-1 h-6 bg-primary rounded-full" />
                                            <h4 className="text-[11px] font-bold uppercase tracking-widest text-secondary">Identidad del Producto</h4>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold uppercase text-accent tracking-widest pl-1">Nombre Comercial</label>
                                                <input
                                                    type="text"
                                                    name="productName"
                                                    className="w-full px-5 py-3.5 bg-surface-soft border border-hairline rounded-[16px] focus:ring-4 focus:ring-primary/10 focus:border-primary/30 focus:outline-none font-bold text-secondary transition-all text-[13px]"
                                                    defaultValue={editingProduct?.name}
                                                    required
                                                    placeholder="Ej: Hamburguesa Angus"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold uppercase text-accent tracking-widest pl-1">Categoría</label>
                                                <div className="relative">
                                                    <select
                                                        name="productCategory"
                                                        className="w-full px-5 py-3.5 bg-surface-soft border border-hairline rounded-[16px] focus:ring-4 focus:ring-primary/10 focus:outline-none font-bold text-secondary appearance-none cursor-pointer text-[13px]"
                                                        defaultValue={editingProduct?.category_id || activeCategory}
                                                        required
                                                    >
                                                        <option value="" disabled>Selecciona...</option>
                                                        {categories.map(cat => (
                                                            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-accent pointer-events-none" size={18} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold uppercase text-accent tracking-widest pl-1">Barcode / SKU</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        name="productBarcode"
                                                        className="w-full pl-5 pr-12 py-3.5 bg-surface-soft border border-hairline rounded-[16px] focus:ring-4 focus:ring-primary/10 focus:outline-none font-bold text-secondary text-[13px]"
                                                        defaultValue={editingProduct?.barcode}
                                                        placeholder="Escanea o escribe..."
                                                    />
                                                    <ScanBarcode className="absolute right-4 top-1/2 -translate-y-1/2 text-accent/40" size={20} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold uppercase text-accent tracking-widest pl-1">Precio Base (PVP)</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        name="productPrice"
                                                        className="w-full pl-10 pr-5 py-3.5 bg-primary/5 border border-primary/10 rounded-[16px] focus:ring-4 focus:ring-primary/10 focus:outline-none font-bold text-primary text-xl"
                                                        defaultValue={editingProduct?.price}
                                                        required
                                                        placeholder="0.00"
                                                    />
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold text-xl">$</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sección: Inventario Inteligente */}
                                    <div className="bg-surface-soft rounded-[24px] border border-hairline p-8 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-success/10 rounded-xl">
                                                    <Package size={16} className="text-success" />
                                                </div>
                                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-secondary">Control de Existencias</h4>
                                            </div>
                                            <span className="px-3 py-1 bg-success/10 text-success rounded-full text-[9px] font-bold uppercase tracking-widest">En Tiempo Real</span>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold uppercase text-accent tracking-widest pl-1">Stock Disponible</label>
                                                <input
                                                    type="number"
                                                    name="productStock"
                                                    className="w-full px-5 py-3.5 bg-canvas border border-hairline rounded-[16px] focus:ring-4 focus:ring-primary/10 focus:outline-none font-bold text-secondary text-[13px]"
                                                    defaultValue={editingProduct?.stock || 0}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold uppercase text-accent tracking-widest pl-1">Alerta de Agotamiento</label>
                                                <input
                                                    type="number"
                                                    name="productStockThreshold"
                                                    className="w-full px-5 py-3.5 bg-canvas border border-hairline rounded-[16px] focus:ring-4 focus:ring-danger/10 focus:outline-none font-bold text-danger text-[13px]"
                                                    defaultValue={editingProduct?.stock_threshold || 5}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Precios por Sede */}
                                    <div className="space-y-5">
                                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-accent pl-1">Variación por Sedes</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {['Sede Norte', 'Sede Sur', 'Sede Centro'].map(branch => (
                                                <div key={branch} className="flex items-center justify-between p-5 bg-surface-soft border border-hairline rounded-[20px] hover:shadow-sm transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <Building2 size={16} className="text-accent group-hover:text-primary transition-colors" />
                                                        <span className="text-[13px] font-bold text-secondary">{branch}</span>
                                                    </div>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-xs">$</span>
                                                        <input
                                                            type="number"
                                                            name={`price${branch}`}
                                                            placeholder="0.00"
                                                            className="w-28 bg-canvas border border-hairline rounded-full pl-6 pr-4 py-2 text-[13px] font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none"
                                                            defaultValue={editingProduct?.branch_prices?.[branch]}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Columna Derecha: Elaboración y Visuales */}
                                <div className="lg:col-span-5 bg-surface-soft/30 p-8 space-y-8">
                                    
                                    {/* Visuales */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-1 h-6 bg-primary rounded-full" />
                                            <h4 className="text-[11px] font-bold uppercase tracking-widest text-secondary">Presentación Visual</h4>
                                        </div>
                                        <div className="bg-canvas rounded-[24px] border border-hairline shadow-sm relative group overflow-hidden">
                                            <div className="aspect-video bg-surface-soft overflow-hidden flex items-center justify-center relative">
                                                {editingProduct?.image ? (
                                                    <img src={editingProduct.image} className="w-full h-full object-cover" alt="Preview" />
                                                ) : (
                                                    <div className="flex flex-col items-center text-accent/30">
                                                        <ImageIcon size={48} strokeWidth={1.5} />
                                                        <span className="text-[11px] font-bold tracking-widest uppercase mt-3">Sin Imagen</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-5 border-t border-hairline">
                                                <label className="text-[11px] font-bold uppercase text-accent tracking-widest block mb-2">URL de la Imagen</label>
                                                <input
                                                    type="text"
                                                    name="productImage"
                                                    className="w-full px-5 py-3.5 bg-surface-soft border border-hairline rounded-full text-[12px] font-bold text-secondary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                    placeholder="https://images.unsplash.com/..."
                                                    defaultValue={editingProduct?.image}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ingredientes */}
                                    <div className="space-y-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-secondary/10 rounded-xl">
                                                <Utensils size={14} className="text-secondary" />
                                            </div>
                                            <h4 className="text-[11px] font-bold uppercase tracking-widest text-secondary">Receta Base</h4>
                                        </div>
                                        <div className="flex gap-3">
                                            <input 
                                                id="new-ing" 
                                                type="text" 
                                                placeholder="Agregar ingrediente..." 
                                                className="flex-1 px-5 py-3 bg-canvas border border-hairline rounded-full text-[13px] font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-sm" 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => { handleAddIngredient(document.getElementById('new-ing').value); document.getElementById('new-ing').value = ''; }} 
                                                className="p-3 bg-secondary text-white rounded-full hover:shadow-airbnb transition-all active:scale-95"
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2.5 pt-2">
                                            {tempIngredients.map((ing, i) => (
                                                <motion.span 
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    key={i} 
                                                    className="inline-flex items-center gap-2 pl-4 pr-2 py-2.5 bg-canvas text-secondary rounded-[16px] text-[11px] font-bold border border-hairline shadow-sm hover:border-danger/20 hover:text-danger transition-all cursor-default"
                                                >
                                                    {ing}
                                                    <button type="button" onClick={() => setTempIngredients(tempIngredients.filter((_, idx) => idx !== i))} className="p-1 hover:bg-danger/10 rounded-full transition-colors">
                                                        <X size={12} />
                                                    </button>
                                                </motion.span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Extras */}
                                    <div className="space-y-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-success/10 rounded-xl">
                                                <PlusCircle size={14} className="text-success" />
                                            </div>
                                            <h4 className="text-[11px] font-bold uppercase tracking-widest text-secondary">Personalización (Extras)</h4>
                                        </div>
                                        <div className="grid grid-cols-12 gap-3">
                                            <input id="extra-name" type="text" placeholder="Nombre" className="col-span-6 px-4 py-3.5 bg-canvas border border-hairline rounded-[16px] text-[13px] font-bold outline-none shadow-sm" />
                                            <input id="extra-price" type="number" placeholder="$ 0" className="col-span-4 px-4 py-3.5 bg-canvas border border-hairline rounded-[16px] text-[13px] font-bold text-success outline-none shadow-sm" />
                                            <button 
                                                type="button" 
                                                onClick={() => { handleAddExtra(document.getElementById('extra-name').value, document.getElementById('extra-price').value); document.getElementById('extra-name').value = ''; document.getElementById('extra-price').value = ''; }} 
                                                className="col-span-2 flex items-center justify-center bg-success text-white rounded-[16px] hover:shadow-airbnb active:scale-95 transition-all shadow-lg shadow-success/10"
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </div>
                                        <div className="space-y-4 pt-2">
                                            {tempExtras.map((extra, i) => (
                                                <motion.div 
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    key={i} 
                                                    className="flex items-center justify-between p-5 bg-canvas rounded-[20px] border border-hairline shadow-sm group hover:shadow-airbnb transition-all"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-success/5 flex items-center justify-center">
                                                            <Plus size={16} className="text-success" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[13px] font-bold text-secondary leading-none mb-1">{extra.name}</span>
                                                            <span className="text-[11px] font-bold text-success uppercase tracking-widest">+${extra.price.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => setTempExtras(tempExtras.filter((_, idx) => idx !== i))} className="p-2.5 text-accent hover:text-danger hover:bg-danger/5 rounded-full transition-all opacity-0 group-hover:opacity-100">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sticky Footer Premium */}
                            <div className="p-8 bg-canvas/80 backdrop-blur-xl border-t border-hairline flex flex-col sm:flex-row gap-4 sticky bottom-0 z-30 shadow-airbnb">
                                <button
                                    type="button"
                                    onClick={() => { setShowProductModal(false); setEditingProduct(null); setTempIngredients([]); setTempExtras([]); }}
                                    className="px-10 py-4 bg-surface-soft text-accent hover:text-danger rounded-full transition-all font-bold text-[11px] uppercase tracking-widest border border-hairline flex items-center justify-center gap-3 order-2 sm:order-1"
                                >
                                    <XCircle size={18} />
                                    <span>Descartar</span>
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] py-4 bg-secondary text-white rounded-full font-bold shadow-airbnb hover:shadow-premium active:scale-95 transition-all text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 order-1 sm:order-2 group"
                                >
                                    <Save size={18} />
                                    <span>{editingProduct ? 'Sincronizar Cambios' : 'Confirmar y Publicar'}</span>
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Modal para Crear/Editar Categoría */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-canvas rounded-[24px] shadow-airbnb w-full max-w-lg overflow-hidden animate-in zoom-in fade-in duration-200 border border-hairline">
                        <div className="bg-secondary p-8 text-white relative overflow-hidden">
                            <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-bold tracking-tight">
                                        {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                                    </h3>
                                    <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest mt-1">
                                        Define el nombre y el emoji identificador
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <form key={editingCategory?.id || 'new'} onSubmit={handleSaveCategory} className="p-8 space-y-8">
                            {/* Nombre de la categoría */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold uppercase text-accent tracking-widest pl-1">
                                    Nombre de la Categoría
                                </label>
                                <input
                                    type="text"
                                    name="categoryName"
                                    defaultValue={editingCategory?.name}
                                    placeholder="Ej: Postres, Bebidas, Entradas..."
                                    className="w-full px-5 py-3.5 bg-surface-soft border border-hairline rounded-[16px] focus:ring-4 focus:ring-primary/10 focus:outline-none font-bold text-secondary text-[13px]"
                                    required
                                />
                            </div>

                            {/* Selector de Emoji */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold uppercase text-accent tracking-widest pl-1">
                                    Icono Emoji
                                </label>
                                <div className="grid grid-cols-8 gap-2.5 p-5 bg-surface-soft border border-hairline rounded-[24px] max-h-56 overflow-y-auto custom-scrollbar">
                                    {CATEGORY_EMOJIS.map((emoji, idx) => (
                                        <label key={idx} className="cursor-pointer">
                                            <input
                                                type="radio"
                                                name="categoryIcon"
                                                value={emoji}
                                                defaultChecked={editingCategory?.icon === emoji}
                                                className="sr-only peer"
                                                required
                                            />
                                            <div className="text-2xl p-2.5 rounded-[12px] bg-canvas border border-hairline hover:shadow-sm peer-checked:bg-secondary peer-checked:text-white peer-checked:scale-110 transition-all text-center">
                                                {emoji}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Botones de Acción */}
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                                    className="flex-1 py-4 bg-surface-soft text-accent border border-hairline rounded-full font-bold text-[11px] uppercase tracking-widest hover:bg-gray-100 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] bg-secondary text-white py-4 rounded-full font-bold shadow-airbnb hover:shadow-premium active:scale-95 transition-all text-[11px] uppercase tracking-widest flex items-center justify-center gap-3"
                                >
                                    <Save size={18} />
                                    {editingCategory ? 'Actualizar' : 'Crear'} Categoría
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showKardexFor && (
                <InventoryKardex 
                    product={showKardexFor} 
                    onClose={() => setShowKardexFor(null)} 
                />
            )}
        </div>
    );
};

export default MenuManagement;
