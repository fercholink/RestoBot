import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Tag, Utensils, IndianRupee, Image as ImageIcon, CheckCircle2, XCircle, ChevronRight, MoreVertical, Filter, Save, X, AlertTriangle, Building2, Layers, Coffee, Pizza, Beef, PlusCircle, MinusCircle } from 'lucide-react';

const INITIAL_CATEGORIES = [
    { id: 1, name: 'Hamburguesas', icon: '🍔' },
    { id: 2, name: 'Salchipapas', icon: '🍟' },
    { id: 3, name: 'Bebidas', icon: '🥤' },
    { id: 4, name: 'Adicionales', icon: '🥓' },
];

const INITIAL_PRODUCTS = [
    {
        id: 1,
        categoryId: 1,
        name: 'Hamburguesa Clásica',
        price: 15000,
        branch_prices: { 'Sede Norte': 15000, 'Sede Sur': 16000, 'Sede Centro': 15000 },
        description: 'Carne 150g, queso, lechuga, tomate y salsas.',
        available: true,
        stock: 3,
        stock_threshold: 5,
        base_ingredients: ['Pan', 'Carne 150g', 'Queso', 'Lechuga', 'Tomate', 'Salsas'],
        extras: [
            { name: 'Tocineta', price: 3000 },
            { name: 'Huevo', price: 2000 },
            { name: 'Doble Queso', price: 2500 }
        ],
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500'
    },
    {
        id: 2,
        categoryId: 1,
        name: 'Hamburguesa Especial',
        price: 22000,
        branch_prices: { 'Sede Norte': 22000, 'Sede Sur': 24000, 'Sede Centro': 22000 },
        description: 'Carne, pollo, tocineta, huevo, queso y ripio.',
        available: true,
        stock: 15,
        stock_threshold: 5,
        base_ingredients: ['Pan', 'Carne 150g', 'Pollo', 'Tocineta', 'Huevo', 'Queso', 'Ripio'],
        extras: [
            { name: 'Queso costeño', price: 2000 },
            { name: 'Pepinillos', price: 1500 }
        ],
        image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=500'
    },
];

// Lista de emojis populares para categorías
const CATEGORY_EMOJIS = [
    '🍔', '🍟', '🍕', '🌭', '🌮', '🌯', '🥙', '🥗', '🍝', '🍜',
    '🍲', '🍱', '🍛', '🍣', '🍤', '🍗', '🍖', '🥓', '🥩', '🍔',
    '🥤', '🍺', '🍻', '🍷', '🍸', '🍹', '🍾', '🧃', '☕', '🍵',
    '🧁', '🍰', '🎂', '🍮', '🍪', '🍩', '🍨', '🍧', '🥧', '🍫'
];

const MenuManagement = () => {
    // Inicializar categorías desde localStorage o usar las iniciales
    const [categories, setCategories] = useState(() => {
        const saved = localStorage.getItem('restobot_categories');
        return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
    });

    // Inicializar productos desde localStorage o usar los iniciales
    const [products, setProducts] = useState(() => {
        const saved = localStorage.getItem('restobot_products');
        return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    });

    const [activeCategory, setActiveCategory] = useState(() => {
        const saved = localStorage.getItem('restobot_categories');
        const cats = saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
        return cats.length > 0 ? cats[0].id : null;
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [showProductModal, setShowProductModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);
    const [selectedBranchForPrice, setSelectedBranchForPrice] = useState('Global');

    // Estados temporales para el modal de edición de productos
    const [tempIngredients, setTempIngredients] = useState([]);
    const [tempExtras, setTempExtras] = useState([]);

    // Guardar categorías en localStorage cada vez que cambien
    useEffect(() => {
        localStorage.setItem('restobot_categories', JSON.stringify(categories));
    }, [categories]);

    // Guardar productos en localStorage cada vez que cambien
    useEffect(() => {
        localStorage.setItem('restobot_products', JSON.stringify(products));
    }, [products]);

    const handleEditProduct = (product) => {
        setEditingProduct(product);
        setTempIngredients(product?.base_ingredients || []);
        setTempExtras(product?.extras || []);
        setShowProductModal(true);
    };

    const handleAddIngredient = (val) => {
        if (!val) return;
        setTempIngredients([...tempIngredients, val]);
    };

    const handleAddExtra = (name, price) => {
        if (!name || !price) return;
        setTempExtras([...tempExtras, { name, price: parseInt(price) }]);
    };

    const filteredProducts = products.filter(p =>
        p.categoryId === activeCategory &&
        (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const toggleAvailability = (productId) => {
        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, available: !p.available } : p
        ));
    };

    const handleDeleteProduct = (productId) => {
        if (window.confirm('¿Estás seguro de eliminar este producto?')) {
            setProducts(prev => prev.filter(p => p.id !== productId));
        }
    };

    // CRUD de Categorías
    const handleSaveCategory = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const name = formData.get('categoryName');
        const icon = formData.get('categoryIcon');

        if (!name || !icon) {
            alert('Por favor completa todos los campos');
            return;
        }

        if (editingCategory) {
            // Editar categoría existente
            setCategories(prev => prev.map(cat =>
                cat.id === editingCategory.id
                    ? { ...cat, name, icon }
                    : cat
            ));
        } else {
            // Crear nueva categoría
            const newCategory = {
                id: Math.max(...categories.map(c => c.id), 0) + 1,
                name,
                icon
            };
            setCategories(prev => [...prev, newCategory]);
            setActiveCategory(newCategory.id);
        }

        setShowCategoryModal(false);
        setEditingCategory(null);
    };

    const handleEditCategory = (category) => {
        setEditingCategory(category);
        setShowCategoryModal(true);
    };

    const handleDeleteCategory = (categoryId) => {
        const productsInCategory = products.filter(p => p.categoryId === categoryId);

        if (productsInCategory.length > 0) {
            if (!window.confirm(`Esta categoría tiene ${productsInCategory.length} producto(s). ¿Deseas eliminarla de todas formas? Los productos se moverán a la primera categoría disponible.`)) {
                return;
            }
            // Mover productos a la primera categoría disponible
            const remainingCategories = categories.filter(c => c.id !== categoryId);
            if (remainingCategories.length > 0) {
                const targetCategoryId = remainingCategories[0].id;
                setProducts(prev => prev.map(p =>
                    p.categoryId === categoryId
                        ? { ...p, categoryId: targetCategoryId }
                        : p
                ));
            } else {
                // Si no hay más categorías, eliminar los productos
                setProducts(prev => prev.filter(p => p.categoryId !== categoryId));
            }
        }

        setCategories(prev => prev.filter(c => c.id !== categoryId));

        // Si eliminamos la categoría activa, cambiar a otra
        if (activeCategory === categoryId) {
            const remaining = categories.filter(c => c.id !== categoryId);
            setActiveCategory(remaining.length > 0 ? remaining[0].id : null);
        }
    };

    // Guardar producto (crear o editar)
    const handleSaveProduct = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const name = formData.get('productName');
        const price = parseFloat(formData.get('productPrice'));
        const categoryId = parseInt(formData.get('productCategory') || activeCategory);
        const stock = parseInt(formData.get('productStock') || 0);
        const stockThreshold = parseInt(formData.get('productStockThreshold') || 5);
        const image = formData.get('productImage');
        const description = formData.get('productDescription') || '';

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

        if (editingProduct) {
            // Editar producto existente
            setProducts(prev => prev.map(p =>
                p.id === editingProduct.id
                    ? {
                        ...p,
                        name,
                        price,
                        categoryId,
                        description,
                        stock,
                        stock_threshold: stockThreshold,
                        branch_prices: branchPrices,
                        base_ingredients: tempIngredients,
                        extras: tempExtras,
                        image: image || p.image
                    }
                    : p
            ));
        } else {
            // Crear nuevo producto
            const newProduct = {
                id: Math.max(...products.map(p => p.id), 0) + 1,
                categoryId,
                name,
                price,
                description,
                available: true,
                stock,
                stock_threshold: stockThreshold,
                branch_prices: branchPrices,
                base_ingredients: tempIngredients,
                extras: tempExtras,
                image: image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'
            };
            setProducts(prev => [...prev, newProduct]);
        }

        // Cerrar modal y limpiar estado
        setShowProductModal(false);
        setEditingProduct(null);
        setTempIngredients([]);
        setTempExtras([]);
    };

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
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEditCategory(cat)}
                                        className={`p-1 rounded-lg hover:bg-white/20 transition-colors ${activeCategory === cat.id ? 'text-white' : 'text-gray-400 hover:text-secondary'}`}
                                        title="Editar"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    {categories.length > 1 && (
                                        <button
                                            onClick={() => handleDeleteCategory(cat.id)}
                                            className={`p-1 rounded-lg hover:bg-red-500/20 transition-colors ${activeCategory === cat.id ? 'text-white hover:text-red-200' : 'text-gray-400 hover:text-red-500'}`}
                                            title="Eliminar"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
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
                                                >
                                                    <Trash2 size={16} />
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
                        <form onSubmit={handleSaveProduct} className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 max-h-[75vh] overflow-y-auto custom-scrollbar">

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
                                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Precio Base</label>
                                        <input
                                            type="number"
                                            name="productPrice"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:outline-none font-black text-primary"
                                            defaultValue={editingProduct?.price}
                                            required
                                        />
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

                                    <h4 className="text-xs font-black uppercase tracking-widest text-secondary border-b border-gray-100 pb-2 mt-8 flex items-center gap-2">
                                        <AlertTriangle size={14} className="text-warning" />
                                        Inventario
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Stock Actual</label>
                                            <input
                                                type="number"
                                                name="productStock"
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/10 text-xs font-bold"
                                                defaultValue={editingProduct?.stock || 0}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Umbral Alerta</label>
                                            <input
                                                type="number"
                                                name="productStockThreshold"
                                                className="w-full px-3 py-2 bg-warning/5 border border-warning/20 rounded-xl focus:ring-2 focus:ring-warning/20 text-xs font-black text-warning"
                                                defaultValue={editingProduct?.stock_threshold || 5}
                                            />
                                        </div>
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
                                        <input id="extra-name" type="text" placeholder="Extra" className="col-span-3 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] outline-none" />
                                        <input id="extra-price" type="number" placeholder="$" className="col-span-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] outline-none font-bold" />
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
                            <div className="p-8 bg-gray-50 flex gap-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-primary text-white py-4 rounded-2xl font-black shadow-premium hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-3"
                                >
                                    <Save size={20} />
                                    {editingProduct ? 'Actualizar' : 'Guardar'} Configuración de Producto
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowProductModal(false); setEditingProduct(null); setTempIngredients([]); setTempExtras([]); }}
                                    className="px-8 py-4 bg-white border border-gray-200 text-secondary rounded-2xl font-black hover:bg-gray-100 transition-all text-sm uppercase tracking-widest"
                                >
                                    Descartar
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

                            <form onSubmit={handleSaveCategory} className="p-8 space-y-6">
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
        </div >
    );
};

export default MenuManagement;
