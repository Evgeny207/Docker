import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types'
import styled from '@emotion/styled';
import Card from '../Card';
import NavigationMenuItem from './NavigationMenuItem';
import MobileNavigationMenu from './MobileNavigationMenu';
import { isWindowDown } from '../utils/responsive';
import { useUIContext } from '../hooks'

const NavWrap = styled(Card)`
  width: ${({ collapsed }) => (collapsed ? '56px' : '240px')};
  height: 100%;
  padding: 12px 0;
  background-color: ${({ theme }) => theme.color.surface};
  display: flex;
  flex-direction: column;
  position: relative;
  transition: width ${({ collapsed }) => (collapsed ? '200ms' : '250ms')}
    cubic-bezier(0.4, 0, 0.2, 1);
  overflow-x: hidden;
  overflow-y: auto;
`;
NavWrap.defaultProps = { elevation: 'sm', rounded: false, direction: 'right' };
const NavTop = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: ${({ last }) => (last ? 'flex-end' : 'flex-start')};
  flex: ${({ last }) => (last ? '1' : '0')};

`;
const NavBottom = styled.div``;
const CondenseNavigationMenuItem = styled(NavigationMenuItem)`
  width: 3.5rem;
  & svg {
    transform: ${({ collapsed }) => (collapsed ? 'rotate(0deg)' : 'rotate(180deg)')};
    transition: 200ms;
  }
`;

const NavigationMenu = ({
  sections,
  activeItem,
  onItemClick,
}) => {
  const {navCollapsed: collapsed, setNavCollapsed: setCollapsed} = useUIContext();
  const [isMobile, setIsMobile] = useState(isWindowDown('xs'));
  const handleResize = () => setIsMobile(isWindowDown('xs'));

  useEffect(() => {
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) return (
    <MobileNavigationMenu />
  );

  return (
    <NavWrap collapsed={collapsed}>
      {sections && sections.map((section, index) => (
        <NavTop key={index} last={index && index + 1 === sections.length}>
          {section.items && section.items.map(item => (
            <NavigationMenuItem
              key={item.id}
              active={activeItem === item.id}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
              href={item.href}
              onClick={() => {
                item.onClick && item.onClick();
                onItemClick && onItemClick(item);
              }}
            />
          ))}
        </NavTop>
      ))}
      <NavBottom>
        <CondenseNavigationMenuItem
          icon="chevron-right"
          collapsed={collapsed}
          onClick={() => setCollapsed(!collapsed)}
        />
      </NavBottom>
    </NavWrap>
  );
};

NavigationMenu.propTypes = {
  sections: PropTypes.array,
  // onItemClick: PropTypes.function
}

export default NavigationMenu;
