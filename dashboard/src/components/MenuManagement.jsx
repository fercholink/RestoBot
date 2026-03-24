import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Tag, Utensils, IndianRupee, Image as ImageIcon, CheckCircle2, XCircle, ChevronRight, MoreVertical, Filter, Save, X, AlertTriangle, Building2, Layers, Coffee, Pizza, Beef, PlusCircle, MinusCircle, Loader2, ScanBarcode } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logInventoryChange } from '../lib/inventory';
import InventoryKardex from './InventoryKardex';
import { History } from 'lucide-react';

const MenuManagement = () => {
    const { user } = useAuth();
    const organizationId = user?.organization_id || null;
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

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
        try {
            const { data: cats } = await supabase
                .from('categories')
                .select('*')
                .eq('organization_id', organizationId)
                .order('id');
            
            const { data: prods } = await supabase
                .from('products')
                .select('*')
                .eq('organization_id', organizationId)
                .order('id');

            if (cats) {
                setCategories(cats);
                setActiveCategory(prev => {
                    if (prev && cats.find(c => c.id == prev)) return prev;
                    return cats.length > 0 ? cats[0].id : null;
                });
            }
            if (prods) setProducts(prods);
        } catch (error) {
            console.error("Error loading inventory:", error);
        } finally {
            setLoading(false);
        }
    }, [organizationId]);

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
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar en esta categoría..."
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={() => { setEditingProduct(null); setTempIngredients([]); setTempExtras([]); setShowProductModal(true); }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm shadow-premium hover:brightness-110 active:scale-95 transition-all"
                    >
                        <Plus size={20} />
                        Nuevo Producto
                    </button>
                    <div className="relative flex items-center bg-white border border-gray-200 rounded-2xl px-4 py-2 shadow-sm">
                        <Building2 size={16} className="text-gray-400 mr-2" />
                        <select
                            className="bg-transparent text-xs font-black uppercase tracking-widest text-secondary focus:outline-none appearance-none pr-4"
                            value={selectedBranchForPrice}
                            onChange={(e) => setSelectedBranchForPrice(e.target.value)}
                        >
                            <option value="Global">Precio Global</option>
                            <option value="Sede Norte">Sede Norte</option>
                            <option value="Sede Sur">Sede Sur</option>
                            <option value="Sede Centro">Sede Centro</option>
                        </select>
                    </div>
                </div>
            </div>

            {categories.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-gray-400 font-bold mb-4">No hay categorías. Crea una para empezar.</p>
                    <button
                        onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                        className="inline-flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-2xl font-black text-sm"
                    >
                        <Plus size={20} /> Crear Categoría
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Lateral: Categorías */}
                    <aside className="lg:col-span-1 space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Categorías</h3>
                            <button
                                onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                                className="text-primary hover:bg-primary/10 p-1 rounded-md transition-colors"
                                title="Nueva Categoría"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-2 pb-2 lg:pb-0">
                            {categories.map((cat) => (
                                <div
                                    key={cat.id}
                                    className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-bold text-sm whitespace-nowrap transition-all group ${activeCategory === cat.id
                                        ? 'bg-secondary text-white shadow-xl translate-x-1'
                                        : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                                        }`}
                                >
                                    <button
                                        onClick={() => setActiveCategory(cat.id)}
                                        className="flex items-center gap-3 flex-1"
                                    >
                                        <span className="text-xl">{cat.icon}</span>
                                        <span>{cat.name}</span>
                                        {activeCategory === cat.id && <ChevronRight className="ml-auto hidden lg:block" size={16} />}
                                    </button>
                                    <div className="flex gap-1 transition-opacity">
                                        <button
                                            onClick={() => handleEditCategory(cat)}
                                            className={`p-1 rounded-lg hover:bg-white/20 transition-colors ${activeCategory === cat.id ? 'text-white' : 'text-gray-400 hover:text-secondary'}`}
                                            title="Editar"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCategory(cat.id)}
                                            className={`p-1 rounded-lg hover:bg-red-500/20 transition-colors ${activeCategory === cat.id ? 'text-white hover:text-red-200' : 'text-gray-400 hover:text-red-500'}`}
                                            title="Eliminar"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
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
                                        className={`bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-premium transition-all duration-300 relative ${!product.available ? 'grayscale-[0.5] opacity-80' : ''}`}
                                    >
                                        {/* Imagen y Badge de Disponibilidad */}
                                        <div className="relative h-40 overflow-hidden">
                                            <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                            <div className="absolute top-3 right-3 flex flex-col gap-2">
                                                <button
                                                    onClick={() => toggleAvailability(product.id)}
                                                    className={`p-2 rounded-xl backdrop-blur-md shadow-lg transition-all ${product.available ? 'bg-success/20 text-success' : 'bg-red-500/20 text-red-500'}`}
                                                    title={product.available ? 'Disponible' : 'Agotado'}
                                                >
                                                    {product.available ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                                                </button>
                                                {isLowStock && product.available && (
                                                    <div className="p-2 rounded-xl backdrop-blur-md bg-warning/20 text-warning shadow-lg animate-pulse" title="Stock Bajo">
                                                        <AlertTriangle size={18} />
                                                    </div>
                                                )}
                                            </div>
                                            {!product.available && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                    <span className="bg-white/90 text-secondary px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">Agotado</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Detalles */}
                                        <div className="p-5 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-black text-secondary tracking-tight group-hover:text-primary transition-colors">{product.name}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isLowStock ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                                            Stock: {product.stock}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-primary text-sm">${currentPrice.toLocaleString()}</span>
                                                    <p className="text-[8px] font-black uppercase text-gray-400">{selectedBranchForPrice}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {(product.base_ingredients || []).slice(0, 3).map((ing, i) => (
                                                    <span key={i} className="text-[8px] bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded-md border border-gray-100 font-bold">{ing}</span>
                                                ))}
                                                {(product.base_ingredients?.length > 3) && <span className="text-[8px] text-gray-300 font-bold">+{product.base_ingredients.length - 3}</span>}
                                            </div>

                                            <div className="pt-4 flex items-center justify-between border-t border-gray-50">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleEditProduct(product)}
                                                        className="p-2 bg-gray-50 text-gray-400 hover:text-secondary hover:bg-gray-100 rounded-xl transition-all"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteProduct(product.id)}
                                                        className="p-2 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setShowKardexFor(product)}
                                                        className="p-2 bg-gray-50 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                                        title="Ver Historial (Kardex)"
                                                    >
                                                        <History size={16} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] font-black uppercase text-gray-400">
                                                    <PlusCircle size={12} className="text-success/50" />
                                                    <span>{product.extras?.length || 0} extras</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {filteredProducts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
                                <Utensils className="text-gray-200 mb-4" size={48} />
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No hay productos en esta categoría</p>
                            </div>
                        )}
                    </main>
                </div>
            )}

            {/* Modal para Crear/Editar Producto */}
            {showProductModal && (
                <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in fade-in duration-200">
                        <div className="bg-secondary p-8 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black tracking-tight">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                                <p className="text-white/60 text-xs font-medium mt-1">Configuración técnica de elaboración y extras</p>
                            </div>
                            <button onClick={() => setShowProductModal(false)} className="relative z-10 p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                            <Beef className="absolute -right-8 -bottom-8 text-white/5 w-48 h-48" />
                        </div>
                        <form key={editingProduct?.id || 'new'} onSubmit={handleSaveProduct} className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 max-h-[75vh] overflow-y-auto custom-scrollbar">

                            {/* Columna 1: Info Básica */}
                            <div className="space-y-6">
                                <h4 className="text-xs font-black uppercase tracking-widest text-secondary border-b border-gray-100 pb-2 flex items-center gap-2">
                                    <Tag size={14} className="text-primary" />
                                    Básicos
                                </h4>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Nombre</label>
                                        <input
                                            type="text"
                                            name="productName"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:outline-none font-bold"
                                            defaultValue={editingProduct?.name}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Categoría</label>
                                        <select
                                            name="productCategory"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:outline-none font-bold text-secondary appearance-none"
                                            defaultValue={editingProduct?.category_id || activeCategory}
                                            required
                                        >
                                            <option value="" disabled>Selecciona una categoría</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Código de Barras / Barcode</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                name="productBarcode"
                                                className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:outline-none font-bold"
                                                defaultValue={editingProduct?.barcode}
                                                placeholder="EAN-13 / QR / SKU"
                                            />
                                            <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Precio Base</label>
                                        <input
                                            type="number"
                                            name="productPrice"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:outline-none font-black text-primary"
                                            defaultValue={editingProduct?.price}
                                            required
                                        />
                                    </div>

                                    {/* Inventario Movido a Básicos */}
                                    <div className="p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 space-y-4">
                                        <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                                            <Package size={12} /> Gestión de Existencias
                                        </h5>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest pl-1">Stock Inicial</label>
                                                <input
                                                    type="number"
                                                    name="productStock"
                                                    className="w-full px-4 py-2 bg-white border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-secondary"
                                                    defaultValue={editingProduct?.stock || 0}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest pl-1">Aviso Crítico</label>
                                                <input
                                                    type="number"
                                                    name="productStockThreshold"
                                                    className="w-full px-4 py-2 bg-white border border-rose-100 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:outline-none font-bold text-rose-500"
                                                    defaultValue={editingProduct?.stock_threshold || 5}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Sedes Activas</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {['Sede Norte', 'Sede Sur', 'Sede Centro'].map(branch => (
                                                <div key={branch} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                                                    <span className="text-[10px] font-bold text-gray-500">{branch}</span>
                                                    <input
                                                        type="number"
                                                        name={`price${branch}`}
                                                        placeholder="Precio"
                                                        className="w-20 bg-white border border-gray-100 rounded-lg px-2 py-1 text-[10px] font-black"
                                                        defaultValue={editingProduct?.branch_prices?.[branch]}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Columna 2: Receta / Ingredientes */}
                            <div className="space-y-6">
                                <h4 className="text-xs font-black uppercase tracking-widest text-secondary border-b border-gray-100 pb-2 flex items-center gap-2">
                                    <Utensils size={14} className="text-primary" />
                                    Ingredientes Base
                                </h4>
                                <div className="space-y-4">
                                    <p className="text-[10px] text-gray-400 font-medium italic">Define qué incluye el producto por defecto.</p>
                                    <div className="flex gap-2">
                                        <input id="new-ing" type="text" placeholder="Ej. Cebolla" className="flex-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none" />
                                        <button type="button" onClick={() => { handleAddIngredient(document.getElementById('new-ing').value); document.getElementById('new-ing').value = ''; }} className="p-2 bg-secondary text-white rounded-xl hover:brightness-110 transition-all"><Plus size={16} /></button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {tempIngredients.map((ing, i) => (
                                            <span key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-secondary rounded-xl text-[10px] font-black border border-gray-200 group">
                                                {ing}
                                                <X size={12} className="cursor-pointer text-gray-400 hover:text-red-500 transition-colors" onClick={() => setTempIngredients(tempIngredients.filter((_, idx) => idx !== i))} />
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Columna 3: Extras y Personalización */}
                            <div className="space-y-6">
                                <h4 className="text-xs font-black uppercase tracking-widest text-secondary border-b border-gray-100 pb-2 flex items-center gap-2">
                                    <PlusCircle size={14} className="text-success" />
                                    Extras Opcionales
                                </h4>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-5 gap-2">
                                        <input id="extra-name" type="text" placeholder="Extra" className="col-span-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] outline-none" />
                                        <input id="extra-price" type="number" placeholder="$ Precio" className="col-span-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] outline-none font-bold" />
                                        <button type="button" onClick={() => { handleAddExtra(document.getElementById('extra-name').value, document.getElementById('extra-price').value); document.getElementById('extra-name').value = ''; document.getElementById('extra-price').value = ''; }} className="col-span-1 flex items-center justify-center bg-success text-white rounded-xl hover:brightness-110 transition-all"><Plus size={16} /></button>
                                    </div>
                                    <div className="space-y-2">
                                        {tempExtras.map((extra, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 group">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-secondary">{extra.name}</span>
                                                    <span className="text-[10px] font-bold text-success">+${extra.price.toLocaleString()}</span>
                                                </div>
                                                <button onClick={() => setTempExtras(tempExtras.filter((_, idx) => idx !== i))} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-4 pt-4">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-secondary border-b border-gray-100 pb-2 flex items-center gap-2">
                                            <ImageIcon size={14} className="text-primary" />
                                            Visuales
                                        </h4>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">URL de Imagen</label>
                                            <input
                                                type="text"
                                                name="productImage"
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-medium"
                                                placeholder="https://..."
                                                defaultValue={editingProduct?.image}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer del Modal */}
                            {/* Footer del Modal (Sticky) */}
                            <div className="p-6 bg-white/95 backdrop-blur-sm border-t border-gray-100 flex gap-4 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                                <button
                                    type="button"
                                    onClick={() => { setShowProductModal(false); setEditingProduct(null); setTempIngredients([]); setTempExtras([]); }}
                                    className="flex-1 py-4 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-2xl border-2 border-transparent hover:border-red-100 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <XCircle size={20} />
                                    <span>Descartar</span>
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-4 bg-secondary text-white rounded-2xl font-black shadow-premium hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 transition-all text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                                >
                                    <Save size={20} className="text-primary" />
                                    <span>{editingProduct ? 'Guardar Cambios' : 'Crear Producto'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )
            }

            {/* Modal para Crear/Editar Categoría */}
            {
                showCategoryModal && (
                    <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in fade-in duration-200">
                            <div className="bg-gradient-to-br from-primary to-secondary p-8 text-white relative overflow-hidden">
                                <div className="relative z-10">
                                    <h3 className="text-2xl font-black tracking-tight">
                                        {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                                    </h3>
                                    <p className="text-white/60 text-xs font-medium mt-1">
                                        Define el nombre y el emoji identificador
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                                    className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X size={24} />
                                </button>
                                <Tag className="absolute -right-8 -bottom-8 text-white/5 w-48 h-48" />
                            </div>

                            <form key={editingCategory?.id || 'new'} onSubmit={handleSaveCategory} className="p-8 space-y-6">
                                {/* Nombre de la categoría */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">
                                        Nombre de la Categoría
                                    </label>
                                    <input
                                        type="text"
                                        name="categoryName"
                                        defaultValue={editingCategory?.name}
                                        placeholder="Ej: Postres, Bebidas, Entradas..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:outline-none font-bold text-secondary"
                                        required
                                    />
                                </div>

                                {/* Selector de Emoji */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">
                                        Icono Emoji
                                    </label>
                                    <div className="grid grid-cols-10 gap-2 p-4 bg-gray-50 border border-gray-100 rounded-2xl max-h-64 overflow-y-auto custom-scrollbar">
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
                                                <div className="text-2xl p-2 rounded-xl hover:bg-white peer-checked:bg-primary peer-checked:scale-110 transition-all text-center">
                                                    {emoji}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Botones de Acción */}
                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-primary text-white py-4 rounded-2xl font-black shadow-premium hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-3"
                                    >
                                        <Save size={20} />
                                        {editingCategory ? 'Actualizar' : 'Crear'} Categoría
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                                        className="px-8 py-4 bg-white border border-gray-200 text-secondary rounded-2xl font-black hover:bg-gray-100 transition-all text-sm uppercase tracking-widest"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {showKardexFor && (
                <InventoryKardex 
                    product={showKardexFor} 
                    onClose={() => setShowKardexFor(null)} 
                />
            )}
        </div >
    );
};

export default MenuManagement;
