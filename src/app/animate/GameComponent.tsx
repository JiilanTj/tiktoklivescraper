'use client';

import { useEffect } from 'react';

interface CrowdSprite extends Phaser.GameObjects.Sprite {
  outlineSprite?: Phaser.GameObjects.Sprite;
}

export default function GameComponent() {
  useEffect(() => {
    const initPhaser = async () => {
      const Phaser = (await import('phaser')).default;

      class CharacterScene extends Phaser.Scene {
        private body!: Phaser.GameObjects.Image;
        private head!: Phaser.GameObjects.Sprite;
        private hostText!: Phaser.GameObjects.Text;
        private djStand!: Phaser.GameObjects.Image;
        private vinyl!: Phaser.GameObjects.Sprite;
        private vinylLeft!: Phaser.GameObjects.Sprite;
        private vinylRight!: Phaser.GameObjects.Sprite;
        private background!: Phaser.GameObjects.Rectangle;
        private equalizers: Phaser.GameObjects.Sprite[] = [];
        private equalizerTimer!: Phaser.Time.TimerEvent;
        private readonly NUMBER_OF_EQUALIZERS = 5;
        private readonly EQUALIZER_SPACING = 300;
        private strobes: Phaser.GameObjects.Sprite[] = [];
        private strobeTimer!: Phaser.Time.TimerEvent;
        private characterTween!: Phaser.Tweens.Tween;
        private crowds: CrowdSprite[] = [];
        private readonly CROWD_SPACING = 600;

        constructor() {
          super({ key: 'CharacterScene' });
        }

        preload() {
          this.load.image('body', '/assets/host/Body.png');
          this.load.spritesheet('head', '/assets/host/Head.png', {
            frameWidth: 24,
            frameHeight: 24
          });
          this.load.image('djstand', '/assets/host/DJ_Stand.png');
          
          this.load.spritesheet('vinyl', '/assets/host/Spinning_Vinyl_strip9.png', {
            frameWidth: 48,
            frameHeight: 24
          });

          // Load equalizer spritesheet
          this.load.spritesheet('equalizer', '/assets/effects/Equalizer_strip6.png', {
            frameWidth: 256,
            frameHeight: 192
          });

          // Load strobe effect spritesheet
          this.load.spritesheet('strobe', '/assets/effects/Blue_and_Red_Strobe_strip8.png', {
            frameWidth: 256,
            frameHeight: 192
          });

          // Load crowd silhouettes
          this.load.spritesheet('crowd_blue', '/assets/crowd/Male_Siloutte_DBlue_strip4.png', {
            frameWidth: 256,
            frameHeight: 96
          });
          this.load.spritesheet('crowd_pink', '/assets/crowd/Male_Siloutte_Pink_strip4.png', {
            frameWidth: 256,
            frameHeight: 96
          });
          this.load.spritesheet('crowd_lblue', '/assets/crowd/Male_Siloutte_LBlue_strip4.png', {
            frameWidth: 256,
            frameHeight: 96
          });
        }

        create() {
          const centerX = this.cameras.main.centerX;
          const centerY = this.cameras.main.centerY;
          const bodyOffset = 135;
          const headOffset = 45;
          const standY = centerY - 70;
          const spacingLeft = 80;
          const spacingRight = 80;
          const heightOffset = 18;

          // Add black background
          const width = this.cameras.main.width;
          const height = this.cameras.main.height;
          this.background = this.add.rectangle(0, 0, width, height, 0x000000);
          this.background.setOrigin(0, 0);
          this.background.setDepth(-1);

          // Create strobe animations with different speeds
          if (!this.anims.exists('strobe_effect_normal')) {
            this.anims.create({
              key: 'strobe_effect_normal',
              frames: this.anims.generateFrameNumbers('strobe', { 
                start: 0,
                end: 7
              }),
              frameRate: 12,
              repeat: -1
            });
          }

          if (!this.anims.exists('strobe_effect_fast')) {
            this.anims.create({
              key: 'strobe_effect_fast',
              frames: this.anims.generateFrameNumbers('strobe', { 
                start: 0,
                end: 7
              }),
              frameRate: 16,
              repeat: -1
            });
          }

          // Add multiple strobe sprites in different positions
          const strobePositions = [
            { x: centerX - 200, y: centerY - bodyOffset + 50, scale: 1.2 },
            { x: centerX + 200, y: centerY - bodyOffset + 50, scale: 1.2 },
            { x: centerX, y: centerY - bodyOffset, scale: 1.5 }
          ];

          strobePositions.forEach(pos => {
            const strobe = this.add.sprite(pos.x, pos.y, 'strobe');
            strobe.setScale(pos.scale);
            strobe.setBlendMode(Phaser.BlendModes.ADD);
            strobe.setAlpha(0.8);
            strobe.setDepth(-0.8); // Behind the DJ but in front of background
            this.strobes.push(strobe);
          });

          // Start random strobe animations
          this.randomizeStrobeEffects();
          
          // Set up timer to change strobe animations
          this.strobeTimer = this.time.addEvent({
            delay: 3000, // Change effects every 3 seconds
            callback: this.randomizeStrobeEffects,
            callbackScope: this,
            loop: true
          });

          // Create equalizer animations with different speeds
          if (!this.anims.exists('equalize_slow')) {
            this.anims.create({
              key: 'equalize_slow',
              frames: this.anims.generateFrameNumbers('equalizer', { 
                start: 0,
                end: 5
              }),
              frameRate: 8,
              repeat: -1
            });
          }

          if (!this.anims.exists('equalize_normal')) {
            this.anims.create({
              key: 'equalize_normal',
              frames: this.anims.generateFrameNumbers('equalizer', { 
                start: 0,
                end: 5
              }),
              frameRate: 12,
              repeat: -1
            });
          }

          if (!this.anims.exists('equalize_fast')) {
            this.anims.create({
              key: 'equalize_fast',
              frames: this.anims.generateFrameNumbers('equalizer', { 
                start: 0,
                end: 5
              }),
              frameRate: 16,
              repeat: -1
            });
          }

          // Add equalizer sprites - positioned horizontally behind the body
          const equalizerY = centerY - bodyOffset + 40; // Increased offset by 10px
          const totalWidth = this.EQUALIZER_SPACING * (this.NUMBER_OF_EQUALIZERS - 1);
          const startX = centerX - totalWidth / 2;

          for (let i = 0; i < this.NUMBER_OF_EQUALIZERS; i++) {
            const equalizer = this.add.sprite(
              startX + (i * this.EQUALIZER_SPACING),
              equalizerY,
              'equalizer'
            );
            equalizer.setScale(1.4);
            equalizer.setDepth(-0.8); // Move equalizers more to the back
            this.equalizers.push(equalizer);
          }
          
          // Start random animation changes for all equalizers
          this.randomizeEqualizerAnimation();
          
          // Set up timer to change animation randomly
          this.equalizerTimer = this.time.addEvent({
            delay: 2000, // Change animation every 2 seconds
            callback: this.randomizeEqualizerAnimation,
            callbackScope: this,
            loop: true
          });

          // Create and scale the DJ stand first
          this.djStand = this.add.image(centerX, centerY - 70, 'djstand');
          this.djStand.setOrigin(0.5);
          const djStandScale = 1.8;
          this.djStand.setScale(djStandScale);

          // Add crowd next to DJ Stand (left side)
          const djCrowdLeft = this.add.sprite(
            centerX - 450, // Left position
            centerY - 170, // Height position
            'crowd_blue'
          ) as CrowdSprite;
          djCrowdLeft.setScale(2.2);
          djCrowdLeft.setDepth(-0.4);
          djCrowdLeft.play('crowd_dance_blue');
          this.crowds.push(djCrowdLeft);

          // Add labels for left stage crowd
          const personWidth = 70;
          const leftLabelStartX = centerX - 350 - (personWidth * 3);
          const labelY = centerY - 275; // Above the stage crowd

          for (let i = 1; i <= 7; i++) {
            const personLabel = this.add.text(
              leftLabelStartX + (personWidth * (i-1)),
              labelY,
              `Orang ${i}`,
              {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                shadow: { color: '#000000', fill: true, blur: 2, offsetX: 1, offsetY: 1 }
              }
            );
            personLabel.setOrigin(0.5);
            personLabel.setDepth(999);
            
            // Add animation to each label
            this.tweens.add({
              targets: personLabel,
              y: '+=8',
              duration: 1000,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1
            });
          }

          // Add crowd next to DJ Stand (right side)
          const djCrowdRight = this.add.sprite(
            centerX + 450, // Symmetrical to the left crowd
            centerY - 170, // Same height as left crowd
            'crowd_blue'
          ) as CrowdSprite;
          djCrowdRight.setScale(2.2);
          djCrowdRight.setDepth(-0.4);
          djCrowdRight.play('crowd_dance_blue');
          this.crowds.push(djCrowdRight);

          // Add labels for right stage crowd
          const rightLabelStartX = centerX + 450 - (personWidth * 3);

          for (let i = 1; i <= 7; i++) {
            const personLabel = this.add.text(
              rightLabelStartX + (personWidth * (i-1)),
              labelY,
              `Orang ${i}`,
              {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                shadow: { color: '#000000', fill: true, blur: 2, offsetX: 1, offsetY: 1 }
              }
            );
            personLabel.setOrigin(0.5);
            personLabel.setDepth(999);
            
            // Add animation to each label
            this.tweens.add({
              targets: personLabel,
              y: '+=8',
              duration: 1000,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1
            });
          }

          // Create vinyl animation if it doesn't exist
          if (!this.anims.exists('spin')) {
            const frames = [];
            for (let i = 0; i < 9; i++) {
              frames.push({ key: 'vinyl', frame: i });
            }

            this.anims.create({
              key: 'spin',
              frames: frames,
              frameRate: 4,
              repeat: -1
            });
          }

          // Helper function to create and setup vinyl sprites
          const createVinyl = (x: number, y: number, scale: number = 1) => {
            const vinyl = this.add.sprite(x, y, 'vinyl', 0);
            vinyl.setOrigin(0.5);
            vinyl.setScale(scale);
            if (this.anims.exists('spin')) {
              vinyl.play('spin');
            }
            return vinyl;
          };

          // Positioning constants
          const vinylScale = 1.4;

          // Create vinyls
          this.vinylLeft = this.add.sprite(centerX - spacingLeft, standY - heightOffset, 'vinyl');
          this.vinylLeft.setScale(vinylScale);
          this.vinylLeft.play('spin');

          this.vinylRight = this.add.sprite(centerX + spacingRight, standY - heightOffset, 'vinyl');
          this.vinylRight.setScale(vinylScale);
          this.vinylRight.play('spin');

          this.vinyl = this.vinylLeft;

          // Character slightly higher
          this.body = this.add.image(centerX, centerY - bodyOffset, 'body');
          this.body.setOrigin(0.5);
          
          this.head = this.add.sprite(centerX, (centerY - bodyOffset) - headOffset, 'head', 0);
          this.head.setOrigin(0.5);

          const characterScale = 2.0;

          this.body.setScale(characterScale);
          this.head.setScale(characterScale);

          // Add HOST text with retro style
          this.hostText = this.add.text(centerX, (centerY - bodyOffset) - headOffset - 35, 'HOST', {
            fontFamily: 'Arial',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            shadow: { color: '#ff00ff', fill: true, blur: 8, offsetX: 2, offsetY: 2 },
            padding: { x: 8, y: 8 }
          });
          this.hostText.setOrigin(0.5);

          // Add floating animation to character and text
          this.characterTween = this.tweens.add({
            targets: [this.body, this.head, this.hostText],
            y: '+=4',
            duration: 100,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
          });

          // Create crowd animation for both colors
          if (!this.anims.exists('crowd_dance_blue')) {
            this.anims.create({
              key: 'crowd_dance_blue',
              frames: this.anims.generateFrameNumbers('crowd_blue', { 
                start: 0,
                end: 3
              }),
              frameRate: 4,
              repeat: -1
            });
          }

          if (!this.anims.exists('crowd_dance_pink')) {
            this.anims.create({
              key: 'crowd_dance_pink',
              frames: this.anims.generateFrameNumbers('crowd_pink', { 
                start: 0,
                end: 3
              }),
              frameRate: 4,
              repeat: -1
            });
          }

          // Add crowd sprites
          const crowdY = centerY + 50; // First row position
          const crowdRow2Y = centerY + 150; // Second row position
          const crowdRow3Y = centerY + 250; // Third row position

          // Positioning constants
          const moveTowardsCenterOffset = 120; // Base offset
          const additionalCenterOffset = 75; // Additional offset towards center
          const fineAdjustmentOffset = 50; // Increased to 50px for wider spacing

          // Calculate base positions
          const baseLeftX = (width / 4) + moveTowardsCenterOffset;
          const baseRightX = ((width * 3) / 4) - moveTowardsCenterOffset;

          // Calculate final positions with all offsets
          const leftSideX = baseLeftX + additionalCenterOffset - fineAdjustmentOffset; // Move right by 75px, then left by 50px
          const rightSideX = baseRightX - additionalCenterOffset + fineAdjustmentOffset; // Move left by 75px, then right by 50px

          // Create animations for all colors
          if (!this.anims.exists('crowd_dance_lblue')) {
            this.anims.create({
              key: 'crowd_dance_lblue',
              frames: this.anims.generateFrameNumbers('crowd_lblue', { 
                start: 0,
                end: 3
              }),
              frameRate: 4,
              repeat: -1
            });
          }

          // Function to create labels for a crowd
          const createCrowdLabels = (crowdX: number, crowdY: number, rowPrefix: string) => {
            const personWidth = 70;
            const labelStartX = crowdX - (personWidth * 3);
            const labelY = crowdY - 105;
            const labels: Phaser.GameObjects.Text[] = [];

            for (let i = 1; i <= 7; i++) {
              const personLabel = this.add.text(
                labelStartX + (personWidth * (i-1)),
                labelY,
                `${rowPrefix} ${i}`,
                {
                  fontFamily: 'Arial',
                  fontSize: '12px',
                  color: '#ffffff',
                  stroke: '#000000',
                  strokeThickness: 3,
                  shadow: { color: '#000000', fill: true, blur: 2, offsetX: 1, offsetY: 1 }
                }
              );
              personLabel.setOrigin(0.5);
              personLabel.setDepth(999);
              labels.push(personLabel);

              // Add animation to each label
              this.tweens.add({
                targets: personLabel,
                y: '+=8',
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
              });
            }
            return labels;
          };

          // Create Row 1 (front row) - Blue silhouettes
          const leftCrowdRow1 = this.add.sprite(
            leftSideX,
            crowdY,
            'crowd_blue'
          ) as CrowdSprite;
          leftCrowdRow1.setScale(2.2);
          leftCrowdRow1.setDepth(-0.3);
          leftCrowdRow1.play('crowd_dance_blue');
          this.crowds.push(leftCrowdRow1);

          // Add labels for left crowd row 1
          const leftRow1Labels = createCrowdLabels(leftSideX, crowdY, 'Orang');

          const rightCrowdRow1 = this.add.sprite(
            rightSideX,
            crowdY,
            'crowd_blue'
          ) as CrowdSprite;
          rightCrowdRow1.setScale(2.2);
          rightCrowdRow1.setDepth(-0.3);
          rightCrowdRow1.play('crowd_dance_blue');
          this.crowds.push(rightCrowdRow1);

          // Add labels for right crowd row 1
          const rightRow1Labels = createCrowdLabels(rightSideX, crowdY, 'Orang');

          // Create Row 2 (middle row) - Pink silhouettes
          const leftCrowdRow2 = this.add.sprite(
            leftSideX,
            crowdRow2Y,
            'crowd_pink'
          ) as CrowdSprite;
          leftCrowdRow2.setScale(2.2);
          leftCrowdRow2.setDepth(-0.2);
          leftCrowdRow2.play('crowd_dance_pink');
          this.crowds.push(leftCrowdRow2);

          // Add labels for left crowd row 2
          const leftRow2Labels = createCrowdLabels(leftSideX, crowdRow2Y, 'Orang');

          const rightCrowdRow2 = this.add.sprite(
            rightSideX,
            crowdRow2Y,
            'crowd_pink'
          ) as CrowdSprite;
          rightCrowdRow2.setScale(2.2);
          rightCrowdRow2.setDepth(-0.2);
          rightCrowdRow2.play('crowd_dance_pink');
          this.crowds.push(rightCrowdRow2);

          // Add labels for right crowd row 2
          const rightRow2Labels = createCrowdLabels(rightSideX, crowdRow2Y, 'Orang');

          // Create Row 3 (back row) - Light Blue silhouettes
          const leftCrowdRow3 = this.add.sprite(
            leftSideX,
            crowdRow3Y,
            'crowd_lblue'
          ) as CrowdSprite;
          leftCrowdRow3.setScale(2.2);
          leftCrowdRow3.setDepth(-0.1);
          leftCrowdRow3.play('crowd_dance_lblue');
          this.crowds.push(leftCrowdRow3);

          // Add labels for left crowd row 3
          const leftRow3Labels = createCrowdLabels(leftSideX, crowdRow3Y, 'Orang');

          const rightCrowdRow3 = this.add.sprite(
            rightSideX,
            crowdRow3Y,
            'crowd_lblue'
          ) as CrowdSprite;
          rightCrowdRow3.setScale(2.2);
          rightCrowdRow3.setDepth(-0.1);
          rightCrowdRow3.play('crowd_dance_lblue');
          this.crowds.push(rightCrowdRow3);

          // Add labels for right crowd row 3
          const rightRow3Labels = createCrowdLabels(rightSideX, crowdRow3Y, 'Orang');

          // Add slight up and down movement to all crowds
          this.crowds.forEach((crowd, index) => {
            const delay = Math.random() * 1000;
            
            // Add movement to crowd
            this.tweens.add({
              targets: [crowd, crowd.outlineSprite].filter(Boolean),
              y: '+=8',
              duration: 1000,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1,
              delay: delay
            });

            // Add movement to labels if it's the first crowd (left front)
            if (index === 0) {
              leftRow1Labels.forEach(label => {
                this.tweens.add({
                  targets: label,
                  y: '+=8',
                  duration: 1000,
                  ease: 'Sine.easeInOut',
                  yoyo: true,
                  repeat: -1,
                  delay: delay
                });
              });
            }
          });

          // Update scales di bagian yang relevan
          this.djStand.setScale(djStandScale);
          this.body.setScale(characterScale);
          this.head.setScale(characterScale);

          // Update crowd scales
          this.crowds.forEach(crowd => {
            crowd.setScale(2.2);
          });

          // Update equalizer scales
          this.equalizers.forEach(equalizer => {
            equalizer.setScale(1.4);
          });

          this.scale.on('resize', this.handleResize, this);
        }

        private handleResize(gameSize: Phaser.Structs.Size) {
          const width = gameSize.width;
          const height = gameSize.height;
          const centerX = width / 2;
          const centerY = height / 2;
          const bodyOffset = 135;
          const headOffset = 45;
          const standY = centerY - 70;
          const spacingLeft = 80;
          const spacingRight = 80;
          const heightOffset = 18;
          
          if (this.body && this.head && this.djStand) {
            // Stop existing tween before repositioning
            if (this.characterTween) {
              this.characterTween.stop();
              this.characterTween.remove();
            }

            // Update background size
            if (this.background) {
              this.background.setSize(width, height);
            }

            // Update strobe positions
            const strobePositions = [
              { x: centerX - 200, y: centerY - bodyOffset + 50, scale: 1.2 },
              { x: centerX + 200, y: centerY - bodyOffset + 50, scale: 1.2 },
              { x: centerX, y: centerY - bodyOffset, scale: 1.5 }
            ];

            this.strobes.forEach((strobe, index) => {
              const pos = strobePositions[index];
              strobe.setPosition(pos.x, pos.y);
            });

            // Update equalizers positions
            const newEqualizerY = centerY - bodyOffset + 40; // Increased offset by 10px
            const totalWidth = this.EQUALIZER_SPACING * (this.NUMBER_OF_EQUALIZERS - 1);
            const startX = centerX - totalWidth / 2;

            this.equalizers.forEach((equalizer, index) => {
              equalizer.setPosition(startX + (index * this.EQUALIZER_SPACING), newEqualizerY);
            });

            // Update character positions
            this.body.setPosition(centerX, centerY - bodyOffset);
            this.head.setPosition(centerX, (centerY - bodyOffset) - headOffset);
            this.hostText.setPosition(centerX, (centerY - bodyOffset) - headOffset - 35);
            this.djStand.setPosition(centerX, standY);
            
            // Update vinyl positions horizontally
            if (this.vinylLeft) {
              this.vinylLeft.setPosition(centerX - spacingLeft, standY - heightOffset);
            }
            if (this.vinylRight) {
              this.vinylRight.setPosition(centerX + spacingRight, standY - heightOffset);
            }

            // Restart floating animation
            this.characterTween = this.tweens.add({
              targets: [this.body, this.head, this.hostText],
              y: '+=4',
              duration: 300,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1
            });
          }

          // Update crowd positions
          if (this.crowds.length > 0) {
            const moveTowardsCenterOffset = 120;
            const additionalCenterOffset = 75;
            const fineAdjustmentOffset = 50; // Increased to 50px
            
            // Calculate base positions
            const baseLeftPos = (width / 4) + moveTowardsCenterOffset;
            const baseRightPos = ((width * 3) / 4) - moveTowardsCenterOffset;
            
            // Calculate final positions with all offsets
            const finalLeftX = baseLeftPos + additionalCenterOffset - fineAdjustmentOffset;
            const finalRightX = baseRightPos - additionalCenterOffset + fineAdjustmentOffset;
            
            // Update all crowds positions
            this.crowds.forEach((crowd, index) => {
              const isRightSide = index % 2 === 1;
              const rowNumber = Math.floor(index / 2);
              const xPos = isRightSide ? finalRightX : finalLeftX;
              const yPos = centerY + 50 + (rowNumber * 100);
              
              crowd.setPosition(xPos, yPos);
            });
          }
        }

        private randomizeEqualizerAnimation() {
          // Random animation selection
          const animations = ['equalize_slow', 'equalize_normal', 'equalize_fast'];
          
          this.equalizers.forEach(equalizer => {
            if (!equalizer) return;

            const randomAnim = animations[Math.floor(Math.random() * animations.length)];
            const randomDelay = Math.random() * 500; // 0-500ms delay
            const randomSpeed = 0.8 + Math.random() * 0.4; // 0.8-1.2 speed multiplier
            
            this.time.delayedCall(randomDelay, () => {
              if (equalizer) {
                equalizer.play(randomAnim);
                equalizer.anims.timeScale = randomSpeed;
              }
            });
          });
        }

        private randomizeStrobeEffects() {
          this.strobes.forEach(strobe => {
            // Random animation selection
            const animations = ['strobe_effect_normal', 'strobe_effect_fast'];
            const randomAnim = animations[Math.floor(Math.random() * animations.length)];
            
            // Random delay and alpha variation
            const randomDelay = Math.random() * 500;
            const randomAlpha = 0.6 + Math.random() * 0.4; // 0.6-1.0 alpha
            
            this.time.delayedCall(randomDelay, () => {
              if (strobe) {
                strobe.play(randomAnim);
                strobe.setAlpha(randomAlpha);
              }
            });
          });
        }

        shutdown() {
          if (this.equalizerTimer) {
            this.equalizerTimer.destroy();
          }
          if (this.strobeTimer) {
            this.strobeTimer.destroy();
          }
          if (this.characterTween) {
            this.characterTween.stop();
            this.characterTween.remove();
          }
        }
      }

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        scale: {
          mode: Phaser.Scale.RESIZE,
          parent: 'phaser-container',
          width: '100%',
          height: '100%',
          autoCenter: Phaser.Scale.CENTER_BOTH,
          expandParent: true,
        },
        backgroundColor: '#2d2d2d',
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
          }
        },
        scene: CharacterScene,
        audio: {
          noAudio: true
        }
      };

      const game = new Phaser.Game(config);

      const resizeGame = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        game.scale.resize(width, height);
      };

      resizeGame();
      window.addEventListener('resize', resizeGame);

      return () => {
        window.removeEventListener('resize', resizeGame);
        game.destroy(true);
      };
    };

    initPhaser();
  }, []);

  return <div id="phaser-container" className="w-full h-full"></div>;
}