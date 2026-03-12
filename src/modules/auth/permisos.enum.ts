export enum Permiso {
  // EMPRESA
  VER_EMPRESA = 'ver_empresa',
  EDITAR_EMPRESA = 'editar_empresa',

  // USUARIOS
  VER_USUARIOS = 'ver_usuarios',
  CREAR_USUARIOS = 'crear_usuarios',
  EDITAR_USUARIOS = 'editar_usuarios',

  // ROLES
  VER_ROLES = 'ver_roles',
  CREAR_ROLES = 'crear_roles',
  EDITAR_ROLES = 'editar_roles',
  ELIMINAR_ROLES = "eliminar_roles",

  // INVENTARIO
  VER_INVENTARIO = 'ver_inventario',
  EDITAR_INVENTARIO = 'editar_inventario',
  VER_KARDEX = 'ver_kardex',
  VER_INVENTARIO_VALORIZADO = 'ver_inventario_valorizado',  

  //PRODUCTOS
  VER_PRODUCTOS = "ver_productos",
  CREAR_PRODUCTOS = "crear_productos",
  EDITAR_PRODUCTOS = "editar_productos",
  ELIMINAR_PRODUCTOS = "eliminar_productos",

  // COMPRAS
  VER_COMPRAS = 'ver_compras',
  CREAR_COMPRAS = 'crear_compras',
  VER_REPORTES_COMPRAS = 'ver_reportes_compras',
  VER_CUENTAS_PAGAR = 'ver_cuentas_pagar',
  PAGAR_CUENTAS = 'pagar_cuentas',
  
  // VENTAS
  VER_VENTAS = 'ver_ventas',
  CREAR_VENTAS = 'crear_ventas',
  ANULAR_VENTAS = 'anular_ventas',
  VER_REPORTES_VENTAS = 'ver_reportes_ventas',

  // CLIENTES
  VER_CLIENTES = 'ver_clientes',
  CREAR_CLIENTES = 'crear_clientes',
  EDITAR_CLIENTES = 'editar_clientes',
  VER_PERFIL_CLIENTE = "ver_perfil_cliente",

  // COBRANZAS
  VER_COBRANZAS = 'ver_cobranzas',
  APROBAR_COBRANZAS = 'aprobar_cobranzas',
  RECHAZAR_COBRANZAS = 'rechazar_cobranzas',

  // CXC
  VER_CXC = 'ver_cxc',

  // PEDIDOS
  VER_PEDIDOS = 'ver_pedidos',
  CREAR_PEDIDOS = 'crear_pedidos',
  EDITAR_PEDIDOS = 'editar_pedidos',
  REVISAR_PEDIDOS = 'revisar_pedidos',
  FACTURAR_PEDIDOS = 'facturar_pedidos',

  // VENDEDORES
  VER_VENDEDORES = "ver_vendedores",
  CREAR_VENDEDORES = "crear_vendedores",
  EDITAR_VENDEDORES = "editar_vendedores",
  ELIMINAR_VENDEDORES = "eliminar_vendedores",

  // ALMACENES
  VER_ALMACENES = "ver_almacenes",
  EDITAR_ALMACENES = "editar_almacenes",

  // PROVEEDORES
  VER_PROVEEDORES = "ver_proveedores",
  CREAR_PROVEEDORES = "crear_proveedores",
  EDITAR_PROVEEDORES = "editar_proveedores",
  ELIMINAR_PROVEEDORES = "eliminar_proveedores",

  // BANCO
  VER_CUENTAS_BANCARIAS = 'ver_cuentas_bancarias',
  CREAR_CUENTAS_BANCARIAS = 'crear_cuentas_bancarias',
  EDITAR_CUENTAS_BANCARIAS = 'editar_cuentas_bancarias',
  ELIMINAR_CUENTAS_BANCARIAS = 'eliminar_cuentas_bancarias',
  VER_MOVIMIENTOS = 'ver_movimientos',
  IMPORTAR_EXTRACTOS = 'importar_extractos',
  VER_TASA_BCV = 'ver_tasa_bcv',
  EDITAR_TASA_BCV = 'editar_tasa_bcv',
}