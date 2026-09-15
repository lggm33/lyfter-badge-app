Proyecto Final: Lyfter Badge App 🎫
Ahora Somos un Equipo 📖
Para este proyecto de Next.js queremos compartirte un caso que nos topamos constantemente en Lyfter. Cada vez que organizamos un evento (presencial, virtual o híbrido), no tenemos una forma real de medir la asistencia al detalle, generar comunidad dentro de una plataforma centralizada, no sabemos con certeza quién asistió, qué charlas vio, qué stands visitó, ni quiénes fueron las personas más activas e involucradas con toda la experiencia. Esa información es super valiosa, ya que así podemos entender qué les interesa a nuestros estudiantes cuando nos visitan en un evento y con ella se nos va también la oportunidad de reconocer y recompensar a quienes más se comprometen con nuestros eventos.
Para este proyecto, teniendo en cuenta tu experiencia, los proyectos que ya has desarrollado, y todo tu expertise, tenemos una confianza plena en tu capacidad. Te invitamos a formar parte del equipo de Lyfter y que construyás esta plataforma: Lyfter Badge App.
Lyfter Badge App 💡
La idea central es la siguiente para esta plataforma:
Una persona llega a un evento de Lyfter y escanea un QR de bienvenida, lo cual la registra oficialmente en ese evento.
A lo largo del evento, va escaneando distintos QRs ubicados en cada charla y cada stand.
Cada QR escaneado le otorga un badge (una especie de comprobante coleccionable de que estuvo ahí) y una cantidad de puntos de experiencia (XP).
Esa experiencia acumulada la hace subir de nivel dentro de la plataforma.
Puede ver su progreso en un leaderboard, comparándose con el resto de asistentes.
Puede compartir sus badges en redes sociales (LinkedIn, Instagram, Facebook, o donde prefiera).
Al completar todos los badges disponibles de un evento, se revela un premio.
Detrás de esta experiencia necesitamos un panel de administración robusto, que le permita a nuestro equipo y a nuestros aliados (empresas con stands) configurar y controlar todo este ecosistema.
Roles del Sistema 👥
La plataforma tiene que reconocer tres roles claramente diferenciados, cada uno con su propio nivel de acceso. Pensemos juntos cómo se relacionan entre sí:
Rol	Alcance	Puede hacer
Super Admin	Toda la plataforma	Administrar empresas, eventos, usuarios y badges de forma global. Control total sobre la aplicación.
Admin de Empresa/Evento	Solo su(s) propio(s) evento(s)	Una empresa puede tener múltiples eventos asociados. Este rol administra únicamente los eventos que pertenecen a su empresa: creación de eventos, badges, seguimiento de participación. No tiene visibilidad sobre eventos de otras empresas.
Participante	Su propia experiencia	Escanea QRs, acumula badges y XP, revisa su perfil y el leaderboard, comparte sus logros.
💡 Piensen bien cómo va a funcionar la relación entre empresas, eventos y administradores: una empresa puede organizar varios eventos a lo largo del tiempo, y sus administradores deben tener acceso únicamente a lo que les pertenece.
Diagrama de Flujo del Usuario 🔄
Este diagrama resume el recorrido completo que sigue un participante dentro de la aplicación: desde que llega al evento hasta que reclama su premio o entra a la rifa. Úsenlo como referencia para pensar la lógica de negocio y los estados que necesita manejar el sistema.
mermaid chart.png
Funcionalidades Clave 🧩
1. Landing Page y Autenticación 🔐
Página de bienvenida que explique qué es Lyfter Badge App y cómo funciona, pensada para atraer tanto a nuevos usuarios como a las empresas interesadas en participar como aliados.
Registro e inicio de sesión, incluyendo la posibilidad de registrarse en el momento en que alguien escanea su primer QR sin tener cuenta todavía.
2. Registro y Check-in a Eventos 🎟️
Escaneo del QR de bienvenida como mecanismo de inscripción a un evento.
Un mismo usuario puede estar inscrito en múltiples eventos a lo largo del tiempo, y su historial debe quedar organizado por evento.
3. Escaneo de Charlas y Stands → Badges 🏷️
Cada charla y cada stand cuenta con su propio QR único, asociado a un badge específico.
Al escanear, la persona recibe el badge (con su ícono, nombre y descripción) y el XP correspondiente.
Debe quedar claro, tanto para el usuario como para el sistema, qué badges pertenecen a qué evento.
4. Sistema de Experiencia (XP) y Niveles ⭐
Cada badge otorga una cantidad de XP configurable por quien administra el evento.
La acumulación de XP debe traducirse en niveles dentro de la plataforma, visibles en el perfil del usuario.
Cuando alguien sube de nivel o desbloquea un badge nuevo, el sistema debe notificarlo, reforzando la sensación de logro en el momento en que ocurre.
5. Leaderboard y Gamificación 🏆
Ranking de participantes, tanto a nivel general de la plataforma como filtrado por evento.
Debe fomentar una sana competencia: quién visitó más stands, quién vio más charlas, quién tiene más XP acumulado.
6. Compartir en Redes Sociales 📣
Posibilidad de compartir los badges obtenidos (por ejemplo, como imagen generada dinámicamente) en plataformas como LinkedIn, Instagram o Facebook.
Tenemos libertad creativa como equipo sobre cómo resolver la generación y el mecanismo de compartición, siempre que la experiencia sea fluida.
7. Perfil del Participante 🙋
Vista con todos los badges acumulados, organizados por evento.
Debe contemplar el estado de un perfil sin badges todavía (alguien que apenas se registró).
Debe reflejar el nivel actual, el XP acumulado y su posición en el leaderboard.
8. Compatibilidad y Experiencia Móvil 📱
Toda la aplicación debe funcionar perfectamente desde un teléfono. Pensamos la plataforma con un enfoque mobile first, ya que gran parte de la experiencia real ocurre en el momento del evento, desde el celular de cada Participante.
El recorrido completo (registro, inicio de sesión, escaneo de QRs, revisión de badges, leaderboard y proceso de compartir en redes sociales) debe poder completarse desde una pantalla de teléfono, sin depender de una computadora en ningún punto del flujo.
Los paneles de Super Admin y Admin de Empresa también deben adaptarse correctamente a dispositivos móviles, considerando que muchas decisiones de gestión pueden surgir en el momento del evento y no solo desde un escritorio.
Botones, formularios y elementos interactivos deben tener un tamaño y espaciado pensados para el uso táctil, evitando errores comunes como elementos demasiado pequeños o mal alineados en pantallas reducidas.
9. Panel de Súper Administrador 🛠️
Gestión global de empresas y sus administradores.
Gestión global de eventos y usuarios de toda la plataforma.
Dashboard de métricas con visibilidad total sobre el uso de la plataforma: charlas y stands más populares, horarios de mayor afluencia, eventos con mayor participación, entre otros indicadores que consideremos valiosos.
Acceso a un registro de auditoría con las acciones relevantes realizadas por cualquier usuario o administrador dentro de la plataforma.
10. Panel de Administrador de Empresa/Evento 🏢
Gestión de eventos, incluyendo, como mínimo:
Nombre y descripción del evento.
Ubicación y país.
Modalidad: presencial, virtual o híbrida.
Fecha de inicio y fecha de cierre.
Estado del evento (por ejemplo: borrador, activo, finalizado).
Galería de imágenes o fotografías del evento.
Configuración del premio a revelar al completar todos los badges.
Gestión de badges asociados a cada evento:
Nombre, descripción y valor de XP.
Selección de un ícono desde una librería de íconos base disponible en la plataforma.
Tipo de badge (por ejemplo: bienvenida, charla, stand, especial).
Nivel de rareza (por ejemplo: común, raro, edición limitada), para poder destacar badges especiales dentro de un evento y hacerlos aún más deseables de coleccionar.
Seguimiento de participación: listado de asistentes por evento, badges redimidos, y quién canjeó cada uno.
Dashboard de métricas propio del evento: charlas y stands más visitados, horarios de mayor afluencia, y cualquier otro indicador que les ayude a entender el comportamiento de los asistentes.
Acceso a un registro de auditoría con las acciones realizadas dentro del alcance de su empresa o evento (por ejemplo, cambios hechos por sus propios administradores).
Validaciones y Casos Especiales 💭
Esta es una de las partes más importantes del proyecto. La plataforma va a vivir situaciones reales y desordenadas, y como equipo tenemos que anticiparlas:
Alguien escanea el QR de un stand sin estar inscrito en el evento todavía. ¿Qué pasa? Debemos definir un flujo claro (por ejemplo, guiarlo primero a registrarse en el evento mediante el QR de bienvenida, o resolverlo de otra forma que consideremos mejor, pero debe estar contemplado y comunicado con claridad).
Un QR ya fue canjeado previamente por esa misma persona. No debe otorgar el badge ni el XP de nuevo, y debe comunicarlo claramente.
Un QR es inválido, expiró, o no corresponde a ningún badge o evento existente. Debe poder manejarse y notificar al usuario.
Alguien intenta escanear un QR fuera de las fechas del evento (antes de que inicie o después de que cierre).
Prevención de fraude: por ejemplo, alguien compartiendo una foto o captura de su QR con otra persona para que ambos reclamen el mismo badge. Pensemos en cómo mitigar este riesgo.
Un evento se completa: debemos definir claramente cuándo se considera "completado" (¿todos los badges disponibles? ¿un mínimo?) y cómo se revela el premio.
La conexión falla a mitad de un escaneo. Muchos de nuestros eventos ocurren en lugares con señal inestable. ¿Qué pasa si alguien escanea un QR y la solicitud no logra completarse? Debemos definir cómo evitar que la persona pierda un badge que sí le correspondía, y cómo evitar que un reintento le otorgue el mismo badge dos veces.
Requerimientos Técnicos ⚙️
Las decisiones de arquitectura, estructura de carpetas, patrones específicos y organización del código deben documentarse y a tu criterio profesional.
El desarrollo debe ser full-stack con Next.js, con persistencia de datos en una base de datos relacional.
Debe existir un sistema de autenticación y autorización basado en roles, que restrinja correctamente el acceso según corresponda a cada uno de los tres roles.
La generación y validación de códigos QR debe basarse en tokens únicos y seguros, evitando que puedan adivinarse o reutilizarse indebidamente.
El manejo de imágenes (badges, galerías de eventos) debe estar optimizado, sin comprometer el rendimiento de la aplicación.
La interfaz debe ser completamente responsive, considerando que buena parte del escaneo de QRs va a ocurrir desde dispositivos móviles, en el momento y en el lugar del evento.
La plataforma debe contar con un sistema de auditoría, que registre las acciones relevantes realizadas por usuarios y administradores, y que quede disponible para su consulta desde los paneles correspondientes.
La aplicación debe estar desplegada en producción, con las variables de entorno correctamente configuradas y separadas del entorno de desarrollo.
Estándares Visuales y Wireframes 🎨
Les compartimos una base de referencia, con los colores de marca de Lyfter y algunas pantallas clave, para que tengan un punto de partida coherente. A partir de ahí, ustedes definen los estilos y el resto de las pantallas del proyecto.
Estándares Visuales 🖌️
Esta es la paleta oficial de colores de Lyfter, y es la que deben usar como colores base de la aplicación:
Color	HEX	Uso
🟢 Verde sage	#add195	Color principal
🔵 Celeste	#71ceff	Acento tecnológico, enlaces, elementos interactivos
🔴 Coral/rosa	#e88f95	Énfasis, alertas, detalles
🟣 Lila/púrpura	#d798e7	Acento creativo, elementos secundarios
🟠 Durazno	#ffcc8b	Acento cálido, fondos suaves
⚫ Gris azulado oscuro	#2d323d	Texto principal y fondos oscuros
✅
Estos colores se pueden combinar con moderación para diferenciar elementos, pero sin abusar de las combinaciones. Es la paleta con la que la aplicación debe construirse.
Wireframes de Referencia 📐
A continuación tienen tres pantallas clave a modo de referencia visual. La idea es que las usen como base de estructura y jerarquía para esas pantallas puntuales, y que apliquen ese mismo criterio visual al resto de las páginas de la aplicación.
Landing page 👋🏻
image.png
Pantalla de escaneo de QR 📷
image.png
Dashboard de administrador 👷🏻
image.png
✅
Recuerda: esto es una referencia de estructura, no una plantilla obligatoria. Pueden modificar la distribución, los componentes y el estilo visual como equipo lo consideren mejor a la hora de definir el resto de las pantallas del proyecto.
Entregables 📦
Repositorio de GitHub, con una separación clara entre la lógica de datos, la lógica de negocio y la interfaz.
Diagrama o script de la base de datos, mostrando las entidades principales (usuarios, empresas, eventos, badges, badges canjeados) y sus relaciones.
Aplicación desplegada en producción en Vercel, con enlace funcional.
Archivo README.md, con instrucciones para utilizar el proyecto y las justificaciones de las decisiones técnicas y de arquitectura tomadas.