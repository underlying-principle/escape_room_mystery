import { useEffect, useRef } from 'react';
import type * as GraphModule from '../engine/graphLayout';
import type { BoardController } from './wordScene';
import { createWordScene } from './wordScene';

interface WordBoardProps {
  words: string[];
  targets: string[];
  lockedPositions: number[][];
  selected: { slot: number; position: number } | null;
  hint: { slot: number; position: number } | null;
  world: 1 | 2 | 3 | 4 | 5 | 6;
  reducedMotion: boolean;
  backdrop: string;
  graph: GraphModule.LevelGraph | null;
  activeKey: string;
  trailKeys: string[];
  lastEdge: { a: string; b: string } | null;
  reveal: boolean;
  revealKeys: string[];
  onTileSelect(slot: number, position: number): void;
}

export function WordBoard(props: WordBoardProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const controller = useRef<BoardController | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    controller.current = createWordScene(mount, (slot, position) => {
      propsRef.current.onTileSelect(slot, position);
    });
    return () => {
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    const c = controller.current;
    if (!c) return;
    c.setRevealKeys(props.revealKeys);
    c.setBoard({
      words: props.words,
      targets: props.targets,
      lockedPositions: props.lockedPositions,
      selected: props.selected,
      hint: props.hint,
      world: props.world,
      reducedMotion: props.reducedMotion,
      backdrop: props.backdrop,
      graph: props.graph,
      activeKey: props.activeKey,
      trailKeys: props.trailKeys,
      lastEdge: props.lastEdge,
      reveal: props.reveal,
    });
  }, [
    props.words.join('|'),
    props.targets.join('|'),
    props.lockedPositions.map((x) => x.join(',')).join('|'),
    props.selected?.slot,
    props.selected?.position,
    props.hint?.slot,
    props.hint?.position,
    props.world,
    props.reducedMotion,
    props.backdrop,
    props.graph,
    props.activeKey,
    props.trailKeys.join('>'),
    props.lastEdge,
    props.reveal,
    props.revealKeys,
  ]);

  return <div className="word-board" ref={mountRef} aria-label="Interactive word tiles" />;
}
