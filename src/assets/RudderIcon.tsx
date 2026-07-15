/**
 * @file assets/RudderIcon.tsx
 * @description Inline React SVG version of the original Rudder.svg asset, so the
 * published package needs no bundler asset handling. Renders the ASV rudder
 * blade with its blue depth gradient.
 *
 * @author Carson Fujita
 * @license MIT
 */
import React from 'react';

export interface RudderIconProps extends React.SVGProps<SVGSVGElement> {
    /** Optional width/height/style overrides pass through to the <svg> element. */
    title?: string;
}

/**
 * @function RudderIcon
 * @description The ASV rudder blade as an inline SVG component. Preserves the
 * original artwork's linear gradient; the gradient id is instance-unique via
 * {@link React.useId} so multiple rudders can render on one page.
 */
export const RudderIcon: React.FC<RudderIconProps> = ({ title, ...svgProps }) => {
    const gradientId = React.useId();

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 54.72 419.2"
            role={title ? 'img' : undefined}
            aria-hidden={title ? undefined : true}
            {...svgProps}
        >
            {title && <title>{title}</title>}
            <defs>
                <linearGradient
                    id={gradientId}
                    x1=".5"
                    y1="301.9"
                    x2="54.22"
                    y2="301.9"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset=".01" stopColor="#fff" />
                    <stop offset=".01" stopColor="#f6fafc" />
                    <stop offset=".04" stopColor="#c8e4f1" />
                    <stop offset=".06" stopColor="#9dcee6" />
                    <stop offset=".08" stopColor="#77bcdd" />
                    <stop offset=".11" stopColor="#57abd4" />
                    <stop offset=".14" stopColor="#3b9ecd" />
                    <stop offset=".17" stopColor="#2593c8" />
                    <stop offset=".21" stopColor="#148bc4" />
                    <stop offset=".26" stopColor="#0885c1" />
                    <stop offset=".33" stopColor="#0181bf" />
                    <stop offset=".51" stopColor="#0081bf" />
                    <stop offset=".69" stopColor="#0180bc" />
                    <stop offset=".77" stopColor="#067cb5" />
                    <stop offset=".83" stopColor="#0f76a8" />
                    <stop offset=".89" stopColor="#1b6e96" />
                    <stop offset=".93" stopColor="#2b637e" />
                    <stop offset=".98" stopColor="#3e5661" />
                    <stop offset="1" stopColor="#4d4d4d" />
                </linearGradient>
            </defs>
            <g>
                <path
                    fill={`url(#${gradientId})`}
                    d="M27.36,418.7c-7.65,0-17.92-16.91-23.44-97.48C.83,276.17.5,229.81.5,211.97c0-14.81,12.05-26.86,26.86-26.86s26.86,12.05,26.86,26.86c0,95.37-7.03,206.73-26.86,206.73Z"
                />
                <path d="M27.36,185.61c14.53,0,26.36,11.82,26.36,26.36,0,17.84-.33,64.19-3.42,109.21-1.96,28.63-4.69,51.36-8.1,67.56-5.13,24.35-10.9,29.46-14.84,29.46-3.93,0-9.7-5.11-14.84-29.46-3.42-16.2-6.14-38.93-8.1-67.56-3.09-45.04-3.42-91.38-3.42-109.21,0-14.53,11.82-26.36,26.36-26.36M27.36,184.61C12.25,184.61,0,196.86,0,211.97S0,419.2,27.36,419.2c27.36,0,27.36-192.12,27.36-207.23s-12.25-27.36-27.36-27.36h0Z" />
            </g>
            <g>
                <path
                    fill="#fff"
                    d="M27.36,215.79c-3.67,0-6.65-2.98-6.65-6.65s2.98-6.65,6.65-6.65,6.65,2.98,6.65,6.65-2.99,6.65-6.65,6.65Z"
                />
                <path d="M27.36,202.98c3.39,0,6.15,2.76,6.15,6.15s-2.76,6.15-6.15,6.15-6.15-2.76-6.15-6.15,2.76-6.15,6.15-6.15M27.36,201.98c-3.95,0-7.15,3.2-7.15,7.15s3.2,7.15,7.15,7.15,7.15-3.2,7.15-7.15-3.2-7.15-7.15-7.15h0Z" />
            </g>
        </svg>
    );
};

export default RudderIcon;
