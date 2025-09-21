import type { ComponentPropsWithoutRef } from 'react';

const BASE_CARD_CLASSNAMES = 'rounded-xl border border-slate-800 bg-slate-900/80 md:p-6 p-4';

type CardProps = ComponentPropsWithoutRef<'section'>;

function Card({ className, children, ...rest }: CardProps) {
    const mergedClassName = className ? `${BASE_CARD_CLASSNAMES} ${className}` : BASE_CARD_CLASSNAMES;

    return (
        <section className={mergedClassName} {...rest}>
            {children}
        </section>
    );
}

export default Card;
