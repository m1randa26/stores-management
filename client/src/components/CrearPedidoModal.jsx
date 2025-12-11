import { useState, useEffect } from 'react'
import { productService } from '../services/productService'
import { orderService } from '../services/orderService'
import Toast from './Toast'

function CrearPedidoModal({ isOpen, onClose, visita, tienda, onSuccess }) {
  const [productos, setProductos] = useState([])
  const [cart, setCart] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [errorProducts, setErrorProducts] = useState('')
  const [serverError, setServerError] = useState('')
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  // Cargar productos activos cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      fetchActiveProducts()
    } else {
      // Limpiar estados al cerrar
      setCart([])
      setSearchQuery('')
      setServerError('')
      setErrorProducts('')
    }
  }, [isOpen])

  const fetchActiveProducts = async () => {
    try {
      setIsLoadingProducts(true)
      setErrorProducts('')
      const response = await productService.getActiveProducts()
      setProductos(response.data)
    } catch (error) {
      setErrorProducts(error.message)
      console.error('Error al cargar productos:', error)
    } finally {
      setIsLoadingProducts(false)
    }
  }

  // Filtrar productos por búsqueda
  const filteredProducts = productos.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Agregar producto al carrito
  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id)

    if (existing) {
      // Incrementar cantidad
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      // Agregar nuevo
      setCart([...cart, {
        id: product.id,
        name: product.name,
        sku: product.sku,
        imageUrl: product.imageUrl,
        unitPrice: parseFloat(product.price),
        quantity: 1
      }])
    }
  }

  // Incrementar cantidad
  const incrementQuantity = (productId) => {
    setCart(cart.map(item =>
      item.id === productId
        ? { ...item, quantity: item.quantity + 1 }
        : item
    ))
  }

  // Decrementar cantidad
  const decrementQuantity = (productId) => {
    setCart(cart.map(item =>
      item.id === productId
        ? { ...item, quantity: Math.max(1, item.quantity - 1) }
        : item
    ))
  }

  // Eliminar del carrito
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId))
  }

  // Calcular total
  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  }

  // Crear orden
  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      setServerError('Debes agregar al menos un producto al carrito')
      return
    }

    setIsCreatingOrder(true)
    setServerError('')

    try {
      const orderData = {
        visitId: visita.id,
        storeId: tienda?.id || visita.storeId,
        storeName: tienda?.name || visita.store?.name,
        storeAddress: tienda?.address || visita.store?.address,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      }

      await orderService.createOrder(orderData)

      // Mostrar toast de éxito
      setToast({
        show: true,
        message: `¡Pedido creado exitosamente! Total: $${calculateTotal().toFixed(2)}`,
        type: 'success'
      })

      // Esperar para que vea el toast
      setTimeout(() => {
        if (onSuccess) {
          onSuccess()
        }
        onClose()
      }, 1500)
    } catch (error) {
      setServerError(error.message)
      console.error('Error al crear pedido:', error)
      setIsCreatingOrder(false)
    }
  }

  const handleClose = () => {
    if (!isCreatingOrder) {
      onClose()
    }
  }

  if (!isOpen || !visita || !tienda) return null

  const total = calculateTotal()

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <button
              onClick={handleClose}
              disabled={isCreatingOrder}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Crear Pedido</h2>
            <div className="text-sm text-gray-600">
              <p className="font-medium">{tienda.name}</p>
              <p className="text-xs">{tienda.address}</p>
            </div>
          </div>

          {/* Server Error */}
          {serverError && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{serverError}</p>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
            {/* Catálogo de Productos */}
            <div className="flex-1 overflow-y-auto p-6 border-b sm:border-b-0 sm:border-r border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Catálogo de Productos</h3>

              {/* Búsqueda */}
              <div className="mb-4">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre o SKU..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  />
                </div>
              </div>

              {/* Loading */}
              {isLoadingProducts && (
                <div className="flex justify-center items-center py-8">
                  <svg
                    className="animate-spin h-8 w-8 text-blue-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </div>
              )}

              {/* Error */}
              {errorProducts && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 text-center">{errorProducts}</p>
                </div>
              )}

              {/* Lista de productos */}
              {!isLoadingProducts && !errorProducts && (
                <div className="space-y-2">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded-lg"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/100x100?text=Sin+Imagen'
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate text-sm">
                          {product.name}
                        </h4>
                        <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                        <p className="text-sm font-bold text-blue-600 mt-1">
                          ${parseFloat(product.price).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}

                  {filteredProducts.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      {searchQuery
                        ? 'No se encontraron productos'
                        : 'No hay productos disponibles'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Carrito */}
            <div className="w-full sm:w-96 flex flex-col bg-gray-50">
              <div className="p-6 flex-1 overflow-y-auto">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Carrito ({cart.length})
                </h3>

                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <svg
                      className="w-16 h-16 mx-auto text-gray-300 mb-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <p className="text-sm text-gray-500">
                      El carrito está vacío
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-lg p-3 border border-gray-200"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded flex-shrink-0"
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/50x50?text=Sin+Imagen'
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 text-sm truncate">
                              {item.name}
                            </h4>
                            <p className="text-xs text-gray-500">{item.sku}</p>
                            <p className="text-sm text-gray-700 mt-1">
                              ${item.unitPrice.toFixed(2)} c/u
                            </p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="flex-shrink-0 text-red-600 hover:text-red-700"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => decrementQuantity(item.id)}
                              className="w-7 h-7 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M20 12H4"
                                />
                              </svg>
                            </button>
                            <span className="w-10 text-center font-medium">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => incrementQuantity(item.id)}
                              className="w-7 h-7 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                />
                              </svg>
                            </button>
                          </div>
                          <p className="font-bold text-gray-900">
                            ${(item.quantity * item.unitPrice).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total y botones */}
              <div className="p-6 border-t border-gray-200 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-bold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ${total.toFixed(2)}
                  </span>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleCreateOrder}
                    disabled={isCreatingOrder || cart.length === 0}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingOrder ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Creando pedido...
                      </span>
                    ) : (
                      'Crear Pedido'
                    )}
                  </button>

                  <button
                    onClick={handleClose}
                    disabled={isCreatingOrder}
                    className="w-full px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        duration={3000}
      />
    </div>
  )
}

export default CrearPedidoModal
