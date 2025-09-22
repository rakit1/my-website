document.addEventListener('DOMContentLoaded', () => {
    // Этот код применяется только при загрузке страницы, для анимации появления.
    // Логика перехода по ссылкам теперь в основном скрипте.
    document.body.classList.add('fade-in');

    const handleLinkClick = (event) => {
        const link = event.target.closest('a');
        
        // Проверяем, что ссылка внутренняя, не является якорем и не открывается в новой вкладке
        if (link && link.href && link.hostname === window.location.hostname && !link.href.includes('#') && link.target !== '_blank') {
            event.preventDefault();
            const destination = link.href;

            document.body.classList.add('fade-out');

            // Уменьшаем задержку для более быстрого перехода
            setTimeout(() => {
                window.location.href = destination;
            }, 250); // 250 миллисекунд
        }
    };

    document.body.addEventListener('click', handleLinkClick);
});
